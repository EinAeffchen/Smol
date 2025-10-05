import os
import time
from collections import defaultdict
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

import hdbscan
import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlmodel import Session, delete, select, text, update
from tqdm import tqdm

import app.database as db
from app.api.media import delete_record
from app.concurrency import heavy_writer
from app.config import settings
from app.database import get_session, safe_commit
from app.logger import logger
from app.models import (
    DuplicateMedia,
    Face,
    Media,
    Person,
    PersonSimilarity,
    ProcessingTask,
    ProcessingTaskRead,
)
from app.processor_registry import load_processors, processors
from app.processors.duplicates import DuplicateProcessor
from app.utils import (
    complete_task,
    generate_perceptual_hash,
    generate_thumbnail,
    get_image_taken_date,
    process_file,
    recalculate_person_appearance_counts,
    split_video,
    vector_from_stored,
    vector_to_blob,
)

router = APIRouter()

# In-memory progress map for transient, richer status (not persisted)
# Maps task_id -> {"current_item": str|None, "current_step": str|None}
_task_progress: dict[str, dict[str, str | None]] = {}


def _set_task_progress(
    task_id: str,
    *,
    current_item: str | None = None,
    current_step: str | None = None,
) -> None:
    entry = _task_progress.setdefault(
        task_id, {"current_item": None, "current_step": None}
    )
    if current_item is not None:
        entry["current_item"] = current_item
    if current_step is not None:
        entry["current_step"] = current_step


def _clear_task_progress(task_id: str) -> None:
    _task_progress.pop(task_id, None)


# ─── 1) PROCESS MEDIA ─────────────────────────────────────────────────────────


def create_and_run_task(
    session: Session,
    background_tasks: BackgroundTasks,
    task_type: Literal[
        "scan",
        "process_media",
        "cluster_persons",
        "find_duplicates",
        "clean_missing_files",
    ],
    callable_task: Callable,
):
    """
    Creates a scan task in the database and adds the actual scan
    to the background tasks queue.
    """
    if settings.general.read_only:
        raise HTTPException(
            status_code=403, detail="Not allowed in read_only mode."
        )

    # Check if a scan is already running to prevent overlap
    try:
        existing_task = session.exec(
            select(ProcessingTask).where(
                ProcessingTask.task_type == task_type,
                ProcessingTask.status == "running",
            )
        ).first()
    except OperationalError as e:
        logger.warning(f"Database error while checking tasks: {e}")
        raise HTTPException(
            status_code=503, detail="Database is busy; try again shortly."
        )

    if existing_task:
        logger.info(f"{task_type} is already running. Skipping new task.")
        # Return the existing task instead of creating a new one
        return existing_task

    # Create a new task. The total will be updated later inside the task itself.
    task = ProcessingTask(task_type=task_type, total=0, processed=0)
    session.add(task)
    session.commit()
    session.refresh(task)

    # Enqueue the background runner
    background_tasks.add_task(callable_task, task.id)
    return task


@router.post(
    "/process_media",
    response_model=ProcessingTask,
    summary="Detect faces and compute embeddings for all unprocessed media",
)
async def start_media_processing(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    logger.info("Starting processing!")
    return create_and_run_task(
        session=session,
        background_tasks=background_tasks,
        task_type="process_media",
        callable_task=_run_media_processing,
    )


@router.post(
    "/refresh_creation_date",
    summary="Detect faces and compute embeddings for all unprocessed media",
)
async def start_creation_refresh(
    session: Session = Depends(get_session),
):
    logger.info("Starting creation_date refresh!")
    batch_size = 100
    batch_count = 0
    offset = 0
    while True:
        media_batch = session.exec(
            select(Media).offset(offset).limit(batch_size)
        ).all()

        if not media_batch:
            break

        for media in media_batch:
            media_path_obj = Path(media.path)
            if media.duration is not None:
                continue

            if not media_path_obj.exists():
                continue
            media.created_at = get_image_taken_date(media_path_obj)

        offset += batch_size
        session.commit()
        batch_count += 1
        logger.info("Finished batch: %s", batch_count)
    return {"Done": "OK"}


def _run_cleanup_and_chain(task_id: str):
    if settings.scan.auto_clean_on_scan:
        _clean_missing_files(task_id)

    logger.info("Cleanup task finished, starting scan task.")
    with Session(db.engine) as new_session:
        next_task = ProcessingTask(task_type="scan", total=0, processed=0)
        new_session.add(next_task)
        new_session.commit()
        new_session.refresh(next_task)

        # Call the next worker in the chain
        _run_scan_and_chain(next_task.id)


def _run_scan_and_chain(task_id: str):
    _run_scan(task_id)

    logger.info("Scan task finished, starting media processing task.")
    with Session(db.engine) as new_session:
        next_task = ProcessingTask(
            task_type="process_media", total=0, processed=0
        )
        new_session.add(next_task)
        new_session.commit()
        new_session.refresh(next_task)

        # Call the next worker in the chain
        _run_media_processing_and_chain(next_task.id)


def _media_processing_conditions() -> list:
    """Return filter clauses for media rows needing processing."""
    conditions: list = []
    active_processors = {
        proc.name for proc in processors if getattr(proc, "active", False)
    }
    # Scene extraction is required whenever any downstream processor needs scenes.
    if active_processors & {"faces", "embedding_extractor", "auto_tagger"}:
        conditions.append(Media.extracted_scenes.is_(False))
    flag_columns = {
        "faces": Media.faces_extracted,
        "auto_tagger": Media.ran_auto_tagging,
        "embedding_extractor": Media.embeddings_created,
    }
    for name, column in flag_columns.items():
        if name in active_processors:
            conditions.append(column.is_(False))
    return conditions


def _run_media_processing_and_chain(task_id: str):
    _run_media_processing(task_id)

    logger.info("Media processing finished.")
    if settings.general.enable_people and settings.scan.auto_cluster_on_scan:
        logger.info("Starting Person Clustering...")
        with Session(db.engine) as new_session:
            next_task = ProcessingTask(
                task_type="cluster_persons", total=0, processed=0
            )
            new_session.add(next_task)
            new_session.commit()
            new_session.refresh(next_task)
        run_person_clustering(next_task.id)  # Call the final worker
    logger.info("Task chain completed")


def _count_media_to_process(session: Session) -> int:
    """Returns a count of media rows that still need processing."""
    conditions = _media_processing_conditions()
    if not conditions:
        return 0
    return (
        session.exec(
            select(func.count(Media.id)).where(or_(*conditions))
        ).first()
        or 0
    )


def _fetch_media_batch_to_process(session: Session, limit: int) -> list[Media]:
    """
    Fetch a single batch of media rows that need processing.

    Uses LIMIT without OFFSET so subsequent calls naturally move
    through the remaining set as flags are updated.
    """
    conditions = _media_processing_conditions()
    if not conditions:
        return []
    return session.exec(
        select(Media)
        .where(or_(*conditions), Media.missing_since.is_(None))
        .order_by(Media.duration.asc())
        .limit(limit)
    ).all()


def _get_or_extract_scenes(
    media: Media, session: Session
) -> list[Image.Image | tuple]:
    """
    Returns existing scenes or extracts them from the media file.
    Handles file errors by logging or deleting the record.
    Returns an empty list if processing cannot continue.
    """
    media_path_obj = Path(media.path)
    suffix = media_path_obj.suffix.lower()

    # If scenes are already extracted, return them.
    # For images, we always re-open, so we don't check media.scenes.
    if media.extracted_scenes and suffix not in settings.scan.IMAGE_SUFFIXES:
        return media.scenes

    try:
        if suffix in settings.scan.IMAGE_SUFFIXES:
            scenes = [Image.open(media_path_obj)]
        else:
            scenes = split_video(media, media_path_obj)
    except FileNotFoundError:
        logger.warning("File not found: %s. Deleting record.", media.path)
        delete_record(media.id, session)
        return []  # Return empty list to skip further processing
    except UnidentifiedImageError:
        logger.warning("Skipping broken image file: %s.", media_path_obj)
        # Mark as processed to avoid re-trying a broken file
        media.extracted_scenes = True
        session.add(media)
        return []
    except Exception:
        logger.exception("Failed to extract scenes for %s.", media.path)
        return []

    media.extracted_scenes = True
    session.add(media)

    # Add new scene objects to the session if they are ORM models
    for scene in scenes:
        if isinstance(scene, tuple) and hasattr(scene[0], "id"):
            session.add(scene[0])

    return scenes


def _apply_processors(media: Media, scenes: list, session: Session) -> bool:
    """
    Applies all active processors to the media and its scenes.
    Returns True if all processors succeeded, False otherwise.
    """
    if not scenes:
        logger.warning(
            "Skipping processors for %s due to no scenes.", media.filename
        )
        # Mark as processed to avoid retrying if scenes failed extraction
        media.faces_extracted = True
        media.ran_auto_tagging = True
        media.embeddings_created = True
        return True

    for proc in processors:
        if not proc.active:
            continue
        try:
            if not proc.process(media, session, scenes=scenes):
                logger.error(
                    "Processor '%s' failed for media %s.",
                    proc.name,
                    media.path,
                )
                # Mark this item as processed to avoid infinite re-queue loops.
                # We conservatively set the downstream flags so the batch query
                # won't keep selecting this media again and stall on the last batch.
                logger.error(
                    "Marking media %s as processed after '%s' failure to prevent re-queue; please investigate logs above.",
                    media.id,
                    proc.name,
                )
                media.faces_extracted = True
                media.ran_auto_tagging = True
                media.embeddings_created = True
                session.add(media)
                safe_commit(session)
                return True
        except Exception as e:
            logger.exception(
                "Processor '%s' raised an exception on media %s: %s",
                proc.name,
                media.path,
                e,
            )
            # Same protective behavior on unexpected exceptions
            logger.error(
                "Marking media %s as processed after exception in '%s' to prevent re-queue; please investigate stack above.",
                media.id,
                proc.name,
            )
            media.faces_extracted = True
            media.ran_auto_tagging = True
            media.embeddings_created = True
            session.add(media)
            safe_commit(session)
            return True
    return True


def _run_media_processing(task_id: str):
    BATCH_SIZE = 100
    with Session(db.engine) as session:
        task = session.get(ProcessingTask, task_id)
        if not task:
            logger.error("Task with id %s not found!", task_id)
            return

        # Initialize task metadata
        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        session.add(task)
        safe_commit(session)

        # Initial transient status
        _set_task_progress(
            task_id, current_step="preparing", current_item=None
        )

        def is_cancelled() -> bool:
            try:
                session.refresh(task, attribute_names=["status"])  # cheap
                return task.status == "cancelled"
            except Exception:
                return False

        # Ensure processors are loaded (in case lifespan didn't run yet)
        if not processors:
            logger.debug("Processor registry empty; loading processors now.")
            _set_task_progress(task_id, current_step="loading_models")
            load_processors()

        # Acquire a process-local heavy write slot to reduce lock thrashing
        with heavy_writer(
            name="process_media", cancelled=is_cancelled
        ) as acquired:
            if not acquired:
                # Cancelled while waiting for lock
                session.refresh(task)
                task.status = "cancelled"
                task.finished_at = datetime.now(timezone.utc)
                session.add(task)
                safe_commit(session)
                _clear_task_progress(task_id)
                return

            for proc in processors:
                proc.active = False
                proc.load_model()

            # Update totals now that processor activation is known
            task.total = _count_media_to_process(session)
            session.add(task)
            safe_commit(session)

            # Process in batches to avoid loading everything at once
            while True:
                # Re-check cancellation between batches
                session.refresh(
                    task, attribute_names=["status"]
                )  # lightweight refresh
                if task.status == "cancelled":
                    logger.info("Task cancelled. Stopping before next batch.")
                    break

                medias_batch = _fetch_media_batch_to_process(
                    session, BATCH_SIZE
                )
                if not medias_batch:
                    logger.info("No more media to process. Finishing.")
                    break

                logger.info(
                    "Processing batch of %d media items...",
                    len(medias_batch),
                )

                for media in medias_batch:
                    # Check for cancellation before starting potentially heavy work
                    session.refresh(
                        task, attribute_names=["status"]
                    )  # check cancel
                    if task.status == "cancelled":
                        logger.info("Task cancelled mid-batch. Stopping.")
                        break

                    if not Path(media.path).exists():
                        if not media.missing_since:
                            media.missing_since = datetime.now(timezone.utc)
                            session.add(media)
                            safe_commit(session)
                            continue
                    else:
                        if media.missing_since:
                            media.missing_since = None
                            media.missing_confirmed = False
                            session.add(media)
                            safe_commit(session)
                    logger.info("Processing: %s", media.filename)
                    _set_task_progress(
                        task_id,
                        current_item=os.fspath(media.path),
                        current_step="extracting_scenes",
                    )
                    scenes = _get_or_extract_scenes(media, session)
                    logger.debug(
                        "Scenes for %s: %s",
                        media.filename,
                        len(scenes) if scenes is not None else 0,
                    )
                    if not scenes and not Path(media.path).exists():
                        # If scenes are empty because the file was deleted, commit and continue
                        safe_commit(session)
                        continue

                    # Execute each processor while updating transient step
                    all_processors_succeeded = True
                    for proc in processors:
                        if not proc.active:
                            continue
                        try:
                            _set_task_progress(
                                task_id,
                                current_item=os.fspath(media.path),
                                current_step=proc.name,
                            )
                            ok = proc.process(media, session, scenes=scenes)
                            if ok is False:
                                all_processors_succeeded = False
                                break
                        except Exception:
                            # Let existing helper handle marking as processed + logging
                            logger.exception(
                                "Processor '%s' failed for %s",
                                proc.name,
                                media.filename,
                            )
                            all_processors_succeeded = False
                            # Fallback to previous behavior to avoid re-try loops
                            media.faces_extracted = True
                            media.ran_auto_tagging = True
                            media.embeddings_created = True
                            session.add(media)
                            safe_commit(session)
                            break

                    if all_processors_succeeded:
                        session.add(media)  # Add the updated media object

                    task.processed += 1
                    session.add(task)
                    # Commit after each media item is fully processed
                    safe_commit(session)
                    # Reset per-item step to a neutral state between items
                    _set_task_progress(task_id, current_step="idle")

                # end for media in batch

            # Allow processors to unload if they need, but keep instances warm
            for proc in processors:
                try:
                    proc.unload()
                except Exception:
                    pass

            # Finalize Task
            session.refresh(task)  # Get final status before updating
            task.status = (
                "completed" if task.status != "cancelled" else "cancelled"
            )
            task.finished_at = datetime.now(timezone.utc)
            session.add(task)
            safe_commit(session)
            _clear_task_progress(task_id)


# ─── 2) CLUSTER PERSONS ────────────────────────────────────────────────────────


@router.post(
    "/cluster_persons",
    response_model=ProcessingTask,
    summary="Cluster face embeddings into Person identities",
)
def start_person_clustering(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    task = create_and_run_task(
        session,
        background_tasks,
        "cluster_persons",
        callable_task=run_person_clustering,
    )
    return task


def _fetch_faces_and_embeddings(
    session: Session, limit: int = 10000, last_id: int = 0
) -> tuple[list[int], np.ndarray]:
    sql = text(
        """
        SELECT f.id, fe.embedding
          FROM face            AS f
          JOIN face_embeddings AS fe
               ON fe.face_id = f.id
         WHERE f.person_id IS NULL
           AND f.id > :last_id
         ORDER BY f.id
         LIMIT :limit
        """
    ).bindparams(last_id=last_id, limit=limit)

    rows = session.exec(sql).all()
    if not rows:
        return [], np.array([])

    face_ids: list[int] = []
    vectors: list[np.ndarray] = []
    for face_id, raw_embedding in rows:
        vec = vector_from_stored(raw_embedding)
        if vec is None or vec.size == 0:
            logger.debug(
                "Skipping face %s for clustering due to missing embedding",
                face_id,
            )
            continue
        norm = float(np.linalg.norm(vec))
        if not np.isfinite(norm) or norm == 0.0:
            logger.debug(
                "Skipping face %s for clustering due to zero-norm embedding",
                face_id,
            )
            continue
        face_ids.append(int(face_id))
        vectors.append((vec / norm).astype(np.float32, copy=False))

    if not face_ids:
        return [], np.array([])

    embeddings = np.vstack(vectors).astype(np.float32, copy=False)
    return face_ids, embeddings


def _cluster_embeddings(
    embeddings: np.ndarray, min_cluster_size=None, min_samples=None
):
    if embeddings.size == 0:
        return np.array([], dtype=int)

    embeddings_64 = embeddings.astype(np.float64, copy=False)

    min_faces_required = max(
        2, int(settings.face_recognition.person_min_face_count)
    )
    sample_count = embeddings_64.shape[0]

    base_min_cluster_size = int(
        min_cluster_size
        if min_cluster_size is not None
        else settings.face_recognition.hdbscan_min_cluster_size
    )
    base_min_samples = int(
        min_samples
        if min_samples is not None
        else settings.face_recognition.hdbscan_min_samples
    )

    base_min_cluster_size = int(
        np.clip(base_min_cluster_size, min_faces_required, sample_count)
    )
    base_min_samples = int(np.clip(base_min_samples, 1, sample_count))
    base_min_samples = min(base_min_samples, base_min_cluster_size)

    attempted: set[tuple[int, int]] = set()
    best_labels: np.ndarray | None = None
    best_score: tuple[int, float] | None = None

    current_min_cluster_size = base_min_cluster_size
    current_min_samples = base_min_samples

    for _ in range(3):
        params = (current_min_cluster_size, current_min_samples)
        if params in attempted:
            break
        attempted.add(params)

        clusterer = hdbscan.HDBSCAN(
            metric="cosine",
            min_cluster_size=current_min_cluster_size,
            min_samples=current_min_samples,
            cluster_selection_method=settings.face_recognition.hdbscan_cluster_selection_method,
            cluster_selection_epsilon=settings.face_recognition.hdbscan_cluster_selection_epsilon,
            algorithm="generic",
        )
        labels = clusterer.fit_predict(embeddings_64)

        non_noise = labels[labels >= 0]
        cluster_count = int(np.unique(non_noise).size)
        noise_ratio = float(np.mean(labels == -1)) if labels.size else 1.0

        logger.debug(
            "HDBSCAN attempt clusters=%d noise=%.2f min_cluster_size=%d min_samples=%d",
            cluster_count,
            noise_ratio,
            current_min_cluster_size,
            current_min_samples,
        )

        score = (cluster_count, -noise_ratio)
        if best_score is None or score > best_score:
            best_score = score
            best_labels = labels

        should_relax = current_min_cluster_size > min_faces_required and (
            cluster_count == 0
            or (
                cluster_count <= 1
                and noise_ratio > 0.85
                and sample_count >= min_faces_required * 3
            )
            or noise_ratio >= 0.95
        )

        if not should_relax:
            break

        next_min_cluster_size = max(
            min_faces_required,
            int(np.ceil(current_min_cluster_size * 0.6)),
        )
        if next_min_cluster_size == current_min_cluster_size:
            break

        current_min_cluster_size = next_min_cluster_size
        current_min_samples = max(
            1,
            min(
                current_min_cluster_size,
                int(np.ceil(current_min_samples * 0.6)),
            ),
        )

    if best_labels is None:
        return np.array([], dtype=int)
    return best_labels


def _group_faces_by_cluster(
    labels: np.ndarray, new_face_ids: list[int], new_embs
) -> dict[int, tuple[list[int], list[np.ndarray]]]:
    clusters = defaultdict(lambda: ([], []))
    for label, face, emb in zip(labels, new_face_ids, new_embs):
        if label != -1:
            clusters[label][0].append(face)
            clusters[label][1].append(emb)
    return clusters


def _filter_embeddings_by_id(
    all_face_ids: list[int],
    all_embeddings: np.ndarray,
    unassigned_ids: list[int],
) -> tuple[list[int], np.ndarray]:
    id_to_emb_map = dict(zip(all_face_ids, all_embeddings))
    unassigned_embs = np.array([id_to_emb_map[id] for id in unassigned_ids])
    return unassigned_ids, unassigned_embs


def _assign_faces_to_clusters(
    clusters: dict[int, tuple[list[int], list[np.ndarray]]], task_id: str
) -> int:
    created = 0
    for face_ids, embeddings in tqdm(clusters.values()):
        if len(face_ids) < settings.face_recognition.person_min_face_count:
            logger.debug(
                "Skipping cluster with %d faces (< person_min_face_count %d)",
                len(face_ids),
                settings.face_recognition.person_min_face_count,
            )
            continue

        embeddings_arr = np.array(embeddings)
        centroid = embeddings_arr.mean(axis=0)
        similarities = embeddings_arr @ centroid

        best_face_id = face_ids[np.argmax(similarities)]

        # Enforce compactness of the cluster to avoid over-merged persons
        diffs = embeddings_arr - centroid
        l2_radii = np.linalg.norm(diffs, axis=1)
        if (
            np.max(l2_radii)
            > settings.face_recognition.person_cluster_max_l2_radius
        ):
            logger.info(
                "Skipping loose cluster (max radius=%.3f > %.3f) with %d faces",
                float(np.max(l2_radii)),
                settings.face_recognition.person_cluster_max_l2_radius,
                len(face_ids),
            )
            continue

        # Each cluster gets its own self-contained transaction
        with Session(db.engine) as session:
            task = session.get(ProcessingTask, task_id)
            if task.status == "cancelled":
                break
            media_count = session.exec(
                select(func.count(func.distinct(Face.media_id))).where(
                    Face.id.in_(face_ids)
                )
            ).first()
            media_count = int(media_count or 0)

            if media_count < settings.face_recognition.person_min_media_count:
                logger.debug(
                    "Skipping cluster with %d media (< person_min_media_count %d)",
                    media_count,
                    settings.face_recognition.person_min_media_count,
                )
                continue
            new_person = Person(
                name=None,
                profile_face_id=best_face_id,
                appearance_count=media_count,
            )
            session.add(new_person)
            session.flush()  # Get new_person.id

            created += 1

            for face_id in face_ids:
                face = session.get(Face, face_id)
                if face:
                    face.person_id = new_person.id
                    session.add(face)
                # logger.info("Added face %s to person: %s", face_id, new_person.id)

            for face_id in face_ids:
                sql_face_emb = text(
                    "UPDATE face_embeddings SET person_id = :p_id WHERE face_id= :f_id"
                ).bindparams(p_id=new_person.id, f_id=face_id)
                session.exec(sql_face_emb)

            person_del = text(
                """
                DELETE FROM person_embeddings WHERE person_id=:p_id
                """
            ).bindparams(p_id=new_person.id)
            session.exec(person_del)
            centroid_blob = vector_to_blob(centroid)
            if centroid_blob is None:
                logger.warning(
                    "Unable to serialize centroid for new person %s; skipping embedding write",
                    new_person.id,
                )
            else:
                sql_person_emb = text(
                    """
                    INSERT INTO person_embeddings(person_id, embedding)
                    VALUES (:p_id, :emb)
                    """
                ).bindparams(p_id=new_person.id, emb=centroid_blob)
                session.exec(sql_person_emb)

            task.processed += len(face_ids)
            session.add(task)
            safe_commit(session)
    return created


def assign_to_existing_persons(
    face_ids: list[int], embs: np.ndarray, task_id: str, threshold: float
) -> list[int]:
    """
    For each face, do a vec0 nearest‐neighbor lookup in person_embeddings.
    'threshold' is interpreted as cosine similarity in [0,1]. We convert it
    to an equivalent L2 threshold for the sqlite-vec distance: L2 = sqrt(2*(1-cos)).
    If L2 <= mapped_threshold, assign face.person_id; else keep for clustering.
    """
    unassigned: list[int] = []
    # Use stricter config for existing person assignment if available
    try:
        strict_cos_thr = getattr(
            settings.face_recognition,
            "existing_person_cosine_threshold",
            threshold,
        )
        cos_thr = float(strict_cos_thr)
        l2_thr = float(np.sqrt(max(0.0, 2.0 * (1.0 - cos_thr))))
    except Exception:
        l2_thr = 0.8  # safe-ish fallback for normalized vectors (cos~0.68)

    with Session(db.engine) as session:
        affected_person_ids: set[int] = set()
        for face_id, emb in tqdm(zip(face_ids, embs), total=len(face_ids)):
            face = session.get(Face, face_id)
            task = session.get(ProcessingTask, task_id)
            assert task

            if task.status == "cancelled":
                break

            vec_param = vector_to_blob(emb)
            if vec_param is None:
                logger.warning(
                    "Skipping face %s due to invalid embedding payload",
                    face_id,
                )
                task.processed += 1
                if task.processed % 100 == 0:
                    if affected_person_ids:
                        recalculate_person_appearance_counts(
                            session, affected_person_ids
                        )
                        affected_person_ids.clear()
                    session.add(task)
                    safe_commit(session)
                continue
            sql = text(
                """
                    SELECT person_id, distance
                      FROM person_embeddings
                     WHERE embedding MATCH :vec
                     ORDER BY distance
                     LIMIT 2
                """
            ).bindparams(vec=vec_param)
            rows = session.exec(sql).all()

            if rows and rows[0][1] <= l2_thr:
                # nearest person is good enough
                person_id = rows[0][0]

                # Enforce margin between best and second-best matches (cosine space)
                if len(rows) > 1:
                    # convert L2->cos: cos = 1 - 0.5 * L2^2 (for normalized vecs)
                    best_cos = 1.0 - 0.5 * float(rows[0][1]) ** 2
                    second_cos = 1.0 - 0.5 * float(rows[1][1]) ** 2
                    min_margin = getattr(
                        settings.face_recognition,
                        "existing_person_min_cosine_margin",
                        0.0,
                    )
                    if (best_cos - second_cos) < float(min_margin):
                        unassigned.append(face_id)
                        task.processed += 1
                        if task.processed % 100 == 0:
                            if affected_person_ids:
                                recalculate_person_appearance_counts(
                                    session, affected_person_ids
                                )
                                affected_person_ids.clear()
                            session.add(task)
                            safe_commit(session)
                        continue

                # Guard against NULL/invalid person_id in the index
                if person_id is None:
                    logger.warning(
                        "Found person_embeddings row with NULL person_id; cleaning up."
                    )
                    session.exec(
                        text(
                            "DELETE FROM person_embeddings WHERE person_id IS NULL"
                        )
                    )
                    unassigned.append(face_id)
                    task.processed += 1
                    if task.processed % 100 == 0:
                        if affected_person_ids:
                            recalculate_person_appearance_counts(
                                session, affected_person_ids
                            )
                            affected_person_ids.clear()
                        session.add(task)
                        safe_commit(session)
                    continue

                person = session.get(Person, person_id)

                # Handle dangling reference where the person no longer exists
                if person is None:
                    logger.warning(
                        "Dangling person_id %s in person_embeddings; removing and skipping face %s",
                        person_id,
                        face_id,
                    )
                    session.exec(
                        text(
                            "DELETE FROM person_embeddings WHERE person_id = :p_id"
                        ).bindparams(p_id=person_id)
                    )
                    unassigned.append(face_id)
                    task.processed += 1
                    if task.processed % 100 == 0:
                        if affected_person_ids:
                            recalculate_person_appearance_counts(
                                session, affected_person_ids
                            )
                            affected_person_ids.clear()
                        session.add(task)
                        safe_commit(session)
                    continue

                # Avoid attaching to tiny/immature persons
                min_apps = getattr(
                    settings.face_recognition,
                    "existing_person_min_appearances",
                    0,
                )
                if (person.appearance_count or 0) < int(min_apps):
                    unassigned.append(face_id)
                    task.processed += 1
                    if task.processed % 100 == 0:
                        if affected_person_ids:
                            recalculate_person_appearance_counts(
                                session, affected_person_ids
                            )
                            affected_person_ids.clear()
                        session.add(task)
                        safe_commit(session)
                    continue

                # Update face if it still exists
                if face is not None:
                    face.person_id = person_id
                    session.add(face)

                    # Keep face_embeddings in sync
                    session.exec(
                        text(
                            """
                            UPDATE face_embeddings
                               SET person_id = :p_id
                             WHERE face_id   = :f_id
                            """
                        ).bindparams(p_id=person_id, f_id=face_id)
                    )

                    affected_person_ids.add(person_id)
                else:
                    logger.warning(
                        "Face %s not found during assignment; skipping update.",
                        face_id,
                    )
            else:
                unassigned.append(face_id)

            task.processed += 1

            # commit periodically to avoid huge transactions
            if task.processed % 100 == 0:
                if affected_person_ids:
                    recalculate_person_appearance_counts(
                        session, affected_person_ids
                    )
                    affected_person_ids.clear()
                session.add(task)
                safe_commit(session)

        if affected_person_ids:
            recalculate_person_appearance_counts(session, affected_person_ids)
            affected_person_ids.clear()
        session.add(task)
        safe_commit(session)
    return unassigned


def _get_face_total(session: Session):
    sql = text(
        """
        SELECT COUNT(*)
          FROM face            AS f
          JOIN face_embeddings AS fe ON fe.face_id = f.id
         WHERE f.person_id IS NULL
        """
    )
    row = session.exec(sql).first()
    return int(row[0]) if row else 0


def run_person_clustering(task_id: str):
    with Session(db.engine) as session:
        task = session.get(ProcessingTask, task_id)
        if not task:
            logger.error("Task %s not found.", task_id)
            return

        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        task.total = _get_face_total(session)
        logger.info("Got %s faces to cluster!", task.total)
        safe_commit(session)

    def is_cancelled() -> bool:
        with Session(db.engine) as s:
            t = s.get(ProcessingTask, task_id)
            return bool(t and t.status == "cancelled")

    with heavy_writer(name="cluster_persons", cancelled=is_cancelled):
        last_id = 0
        while True:
            logger.info("--- Starting new Clustering Batch ---")
            with Session(db.engine) as session:
                logger.debug("Continuing from id: %s", last_id)
                batch_face_ids, batch_embeddings = _fetch_faces_and_embeddings(
                    session,
                    last_id=last_id,
                    limit=settings.face_recognition.cluster_batch_size,
                )
                if batch_face_ids:
                    last_id = batch_face_ids[-1]

            if len(batch_face_ids) == 0:
                logger.info(
                    "No more unassigned faces found. Finishing process."
                )
                break  # Exit the while loop

            logger.info("Processing batch of %d faces...", len(batch_face_ids))

            # Fetch embeddings once
            person_exists = False
            with Session(db.engine) as session:  # Quick, read-only check
                person_exists = (
                    session.exec(select(Person).limit(1)).first() is not None
                )

            if person_exists:
                logger.debug(
                    "Trying to assign faces to known persons: thresh: %s",
                    settings.face_recognition.face_match_cosine_threshold,
                )
                unassigned_face_ids = assign_to_existing_persons(
                    batch_face_ids,
                    batch_embeddings,
                    task_id,
                    threshold=settings.face_recognition.face_match_cosine_threshold,
                )
                if not unassigned_face_ids:
                    logger.info(
                        "All faces in batch were assigned to existing persons."
                    )
                    continue  # Go to the next batch

                new_faces_ids, new_embs = _filter_embeddings_by_id(
                    batch_face_ids, batch_embeddings, unassigned_face_ids
                )
            else:
                new_faces_ids, new_embs = batch_face_ids, batch_embeddings

            if len(new_embs) >= max(
                2, int(settings.face_recognition.person_min_face_count)
            ):
                labels = _cluster_embeddings(new_embs)
                clusters = _group_faces_by_cluster(
                    labels, new_faces_ids, new_embs
                )
                created_count = _assign_faces_to_clusters(clusters, task_id)
                logger.info(
                    "Cluster batch produced %d new persons out of %d candidate clusters",
                    created_count,
                    len(clusters),
                )
            if (
                len(batch_face_ids)
                < settings.face_recognition.cluster_batch_size
            ):
                break

        with Session(db.engine) as session:
            task = session.get(ProcessingTask, task_id)
            logger.info("FINISHED CLUSTERING!")
            complete_task(session, task)


# ─── 3) CANCEL / LIST / GET TASKS ─────────────────────────────────────────────


@router.post("/{task_id}/cancel", summary="Cancel a running task")
def cancel_task(
    task_id: str,
    session: Session = Depends(get_session),
):
    if settings.general.read_only:
        return HTTPException(
            status_code=403,
            detail="Not allowed in settings.general.read_only mode.",
        )
    task = session.get(ProcessingTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status not in ("pending", "running"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel task in status {task.status}",
        )
    task.status = "cancelled"
    task.finished_at = datetime.now(timezone.utc)
    session.add(task)
    safe_commit(session)
    return task


@router.get("/", response_model=list[ProcessingTask], summary="List all tasks")
def list_tasks(session: Session = Depends(get_session)):
    return session.exec(select(ProcessingTask)).all()


@router.get(
    "/active",
    response_model=list[ProcessingTaskRead],
    summary="List all active tasks with transient details",
)
def list_active_tasks(session: Session = Depends(get_session)):
    try:
        active = session.exec(
            select(ProcessingTask).where(ProcessingTask.status == "running")
        ).all()
        result: list[ProcessingTaskRead] = []
        for t in active:
            base = t.model_dump()
            extra = _task_progress.get(t.id, {})
            base.update(extra)
            result.append(ProcessingTaskRead(**base))
        return result
    except OperationalError:
        time.sleep(10)
        return list_active_tasks(session)


@router.get(
    "/{task_id}", response_model=ProcessingTask, summary="Get task status"
)
def get_task(task_id: str, session: Session = Depends(get_session)):
    task = session.get(ProcessingTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


# ─── 4) SCAN FOLDER  ─────────────────────────────────────────────


@router.post(
    "/scan", response_model=ProcessingTask, summary="Enqueue a media‐scan task"
)
def start_scan(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    # Quick validation to avoid creating no-op tasks
    if not settings.general.media_dirs:
        raise HTTPException(
            status_code=400, detail="No media directories configured."
        )
    logger.debug("Starting scan task...")
    task = create_and_run_task(
        session=session,
        background_tasks=background_tasks,
        task_type="scan",
        callable_task=_run_scan,
    )
    return task


@router.post(
    "/find_duplicates",
    response_model=ProcessingTask,
    summary="Find and group duplicate images",
)
def start_duplicate_detection(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    threshold: int = 2,
):
    task = create_and_run_task(
        session=session,
        background_tasks=background_tasks,
        task_type="find_duplicates",
        callable_task=lambda task_id: _run_duplicate_detection(
            task_id, threshold
        ),
    )
    return task


# ─── 5) HELPER ─────────────────────────────────


def _run_duplicate_detection(task_id: str, threshold: int):
    with Session(db.engine) as session:
        task = session.get(ProcessingTask, task_id)
        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        session.commit()

    def is_cancelled() -> bool:
        with Session(db.engine) as s:
            t = s.get(ProcessingTask, task_id)
            return bool(t and t.status == "cancelled")

    with heavy_writer(name="find_duplicates", cancelled=is_cancelled):
        generate_hashes(task_id)
        processor = DuplicateProcessor(task_id, threshold)
        processor.process()

    # Clean up any empty duplicate groups that were created
    with Session(db.engine) as session:
        empty_groups = session.exec(
            text("""
                SELECT group_id FROM (
                    SELECT group_id, COUNT(*) as cnt 
                    FROM duplicatemedia 
                    GROUP BY group_id
                ) WHERE cnt < 2
            """)
        ).all()
        if empty_groups:
            logger.info(
                f"Cleaning up {len(empty_groups)} empty duplicate groups"
            )
            session.exec(
                delete(DuplicateMedia).where(
                    DuplicateMedia.group_id.in_([
                        row[0] for row in empty_groups
                    ])
                )
            )
            session.commit()


@router.post("/reset/processing", summary="Resets media processing status")
def reset_processing(session: Session = Depends(get_session)):
    if settings.general.read_only:
        return HTTPException(
            status_code=403,
            detail="Not allowed in settings.general.read_only mode.",
        )
    with heavy_writer(name="reset_processing"):
        session.exec(update(Media).values(faces_extracted=False))
        session.exec(update(Media).values(embeddings_created=False))
        session.exec(text("DELETE FROM face_embeddings"))
        session.exec(text("DELETE FROM media_embeddings"))
        for face in tqdm(session.exec(select(Face)).all()):
            path = face.thumbnail_path
            if path:
                path = Path(path)
            if path and path.exists():
                path.unlink()
            session.exec(delete(Face).where(Face.id == face.id))
        safe_commit(session)
    return "OK"


@router.post("/reset/clustering", summary="Resets person clustering")
def reset_clustering(session: Session = Depends(get_session)):
    if settings.general.read_only:
        return HTTPException(
            status_code=403,
            detail="Not allowed in settings.general.read_only mode.",
        )
    with heavy_writer(name="reset_clustering"):
        session.exec(delete(PersonSimilarity))
        session.exec(
            update(Face).values(person_id=None).where(Face.person_id != None)
        )
        session.exec(delete(Person))
        session.exec(text("UPDATE face_embeddings SET person_id=-1"))
        session.exec(text("DELETE FROM person_embeddings"))
        safe_commit(session)
    return "OK"


def _clean_missing_files(task_id: str):
    """Background task to scan for and handle missing files."""
    with Session(db.engine) as session:
        task = session.get(ProcessingTask, task_id)
        if not task:
            logger.error("Task %s not found", task_id)
            return

        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        task.total = session.exec(select(func.count(Media.id))).first()
        session.commit()

        processed = 0
        flagged = 0
        recovered = 0
        auto_deleted = 0
        batch_size = 200
        last_id = 0

        def is_cancelled() -> bool:
            try:
                session.refresh(task, attribute_names=["status"])
                return task.status == "cancelled"
            except Exception:
                return False

        grace_hours = max(0, settings.scan.auto_cleanup_grace_hours)
        grace_delta = timedelta(hours=grace_hours)
        auto_cleanup_enabled = settings.scan.auto_cleanup_without_review

        with heavy_writer(name="clean_missing_files", cancelled=is_cancelled):
            while True:
                media_batch = session.exec(
                    select(Media)
                    .where(Media.id > last_id)
                    .order_by(Media.id)
                    .limit(batch_size)
                ).all()

                if not media_batch:
                    break

                for media in media_batch:
                    last_id = media.id
                    processed += 1
                    media_path = Path(media.path)
                    current_time = datetime.now(timezone.utc)

                    if not media_path.exists():
                        if media.missing_since is None:
                            media.missing_since = current_time
                        if auto_cleanup_enabled:
                            cutoff = current_time - grace_delta
                            if grace_delta == timedelta(0) or (
                                media.missing_since
                                and media.missing_since <= cutoff
                            ):
                                delete_record(media.id, session)
                                auto_deleted += 1
                                continue
                        media.missing_confirmed = False
                        session.add(media)
                        flagged += 1
                    else:
                        if (
                            media.missing_since is not None
                            or media.missing_confirmed
                        ):
                            media.missing_since = None
                            media.missing_confirmed = False
                            session.add(media)
                            recovered += 1

                task.processed = processed
                session.commit()

        task.status = "completed"
        task.finished_at = datetime.now(timezone.utc)
        session.commit()
        logger.info(
            "Missing files cleanup processed=%d flagged=%d recovered=%d auto_deleted=%d",
            processed,
            flagged,
            recovered,
            auto_deleted,
        )


def _run_scan(task_id: str):
    """Scan media directories and stream inserts to DB in small commits.

    This avoids holding large in-memory lists and keeps progress updates
    responsive for very large libraries.
    """
    # 1) Mark task running
    with Session(db.engine) as sess:
        task = sess.get(ProcessingTask, task_id)
        if not task:
            logger.error("Task %s not found.", task_id)
            return
        task.status = "running"
        task.processed = 0
        task.started_at = datetime.now(timezone.utc)
        safe_commit(sess)

    # Helper to iterate all candidate files
    def walk_candidates():
        for media_dir in settings.general.media_dirs:
            for root, dirs, files in os.walk(
                media_dir, topdown=True, followlinks=True
            ):
                if ".omoide" in dirs:
                    dirs.remove(".omoide")
                for fname in files:
                    suffix = Path(fname).suffix.lower()
                    if (
                        suffix
                        not in settings.scan.VIDEO_SUFFIXES
                        + settings.scan.IMAGE_SUFFIXES
                    ):
                        continue
                    # Keep using resolved absolute paths for consistency with DB
                    yield (Path(root) / fname).resolve()

    # 2) Fast pre-count with minimal DB round-trips.
    #    - Preload existing paths per media_dir using LIKE prefix
    #    - Build a list of new files in one pass over the filesystem
    #    - Update task.total periodically for responsiveness
    BATCH_COMMIT = 1000
    new_files: list[Path] = []
    existing_paths: set[str] = set()
    missing_candidates: dict[str, int] = {}

    with Session(db.engine) as sess:
        # Preload existing paths000/dateor each configured media directory
        try:
            for d in settings.general.media_dirs:
                # Use an index-friendly prefix range instead of LIKE.
                # This allows SQLite to leverage the (unique) index on media.path.
                try:
                    prefix = os.fspath(Path(d).resolve())
                except Exception:
                    prefix = os.fspath(Path(d))
                lo = prefix
                hi = (
                    prefix + "\uffff"
                )  # upper bound for all strings with prefix
                try:
                    rows = sess.exec(
                        select(
                            Media.id,
                            Media.path,
                            Media.missing_since,
                            Media.missing_confirmed,
                        ).where(Media.path >= lo, Media.path < hi)
                    ).all()
                    for media_id, p, missing_since, missing_confirmed in rows:
                        existing_paths.add(p)
                        if missing_since is not None or missing_confirmed:
                            missing_candidates[p] = media_id
                except Exception:
                    # If range scan fails, skip preload for this dir
                    pass
        except Exception:
            pass

        task = sess.get(ProcessingTask, task_id)
        since_update = 0
        recovered_ids: set[int] = set()
        for path in walk_candidates():
            spath = str(path)
            candidate_id = missing_candidates.pop(spath, None)
            if candidate_id is not None:
                recovered_ids.add(candidate_id)
            if spath in existing_paths:
                continue
            logger.debug("Handling: %s", path)
            new_files.append(path)
            existing_paths.add(spath)  # avoid duplicates from symlinks
            since_update += 1
            if since_update >= BATCH_COMMIT:
                task.total = len(new_files)
                sess.add(task)
                safe_commit(sess)
                since_update = 0
        if recovered_ids:
            sess.exec(
                update(Media)
                .where(Media.id.in_(tuple(recovered_ids)))
                .values(missing_since=None, missing_confirmed=False)
            )
        # Finalize total
        task.total = len(new_files)
        sess.add(task)
        safe_commit(sess)

    if not new_files:
        with Session(db.engine) as sess:
            task = sess.get(ProcessingTask, task_id)
            task.status = "completed"
            task.finished_at = datetime.now(timezone.utc)
            safe_commit(sess)
        logger.info("No new files to process. Scan finished.")
        return

    # 3) Insert/process in a streaming fashion under heavy-writer lock
    def is_cancelled() -> bool:
        with Session(db.engine) as s:
            t = s.get(ProcessingTask, task_id)
            return bool(t and t.status == "cancelled")

    with heavy_writer(name="scan", cancelled=is_cancelled):
        with Session(db.engine) as sess:
            task = sess.get(ProcessingTask, task_id)
            processed = task.processed or 0
            batch_since_commit = 0
            CHECK_EVERY_SEC = 5
            next_cancel_check = time.monotonic() + CHECK_EVERY_SEC

            for filepath in new_files:
                if time.monotonic() >= next_cancel_check:
                    next_cancel_check = time.monotonic() + CHECK_EVERY_SEC
                    sess.refresh(task, attribute_names=["status"])  # cheap
                    if task.status == "cancelled":
                        logger.info("Scan cancelled by user.")
                        # Commit any pending batch before finalizing status
                        if batch_since_commit > 0:
                            task.processed = processed
                            sess.add(task)
                            safe_commit(sess)
                            batch_since_commit = 0
                        break

                media_obj = process_file(filepath)
                if not media_obj:
                    logger.info("Could not process file!")
                    # Could not probe/process – do not count as processed
                    continue

                # Insert and flush to get an ID for thumbnail filename
                sess.add(media_obj)
                try:
                    sess.flush()  # assigns media_obj.id
                except IntegrityError:
                    # Another process may have inserted this path between
                    # pre-count and now. Roll back this object and skip.
                    sess.rollback()
                    continue

                thumb = generate_thumbnail(media_obj)
                if not thumb:
                    # Remove the record if we failed to thumbnail
                    try:
                        sess.delete(media_obj)
                    except Exception:
                        pass
                    safe_commit(sess)
                    continue

                media_obj.thumbnail_path = thumb
                sess.add(media_obj)

                processed += 1
                batch_since_commit += 1
                if batch_since_commit >= BATCH_COMMIT:
                    task.processed = processed
                    sess.add(task)
                    safe_commit(sess)
                    batch_since_commit = 0

            # Finalize
            sess.refresh(task)
            task.status = (
                "completed" if task.status != "cancelled" else "cancelled"
            )
            task.finished_at = datetime.now(timezone.utc)
            sess.add(task)
            # Final commit with any remaining items in the last partial batch
            if batch_since_commit > 0:
                task.processed = processed
            safe_commit(sess)


def generate_hashes(task_id: int | None = None):
    """A task to find all media without a pHash and generate one."""
    BATCH_SIZE = 10
    FAILURE_MARKER = ""
    with Session(db.engine) as session:
        task = session.get(ProcessingTask, task_id) if task_id else None
        logger.info("Got task!")
        # If there's a task, get the initial total count
        if task:
            count_stmt = select(func.count(Media.id)).where(
                Media.phash.is_(None),
            )
            total_count = session.exec(count_stmt).first() or 0
            logger.info("SET count to %s", total_count)
            task.total = total_count
            task.processed = 0
            session.commit()  # Commit the initial total count

        def is_cancelled() -> bool:
            if not task:
                return False
            session.refresh(task, attribute_names=["status"])  # cheap
            return task.status == "cancelled"

        processed_so_far = task.processed if task else 0

        with heavy_writer(name="generate_hashes", cancelled=is_cancelled):
            while True:
                # Fetch a batch of media objects that need a hash
                media_batch_stmt = (
                    select(Media)
                    .where(
                        Media.phash.is_(None),
                    )
                    .limit(BATCH_SIZE)
                )
                media_to_hash = session.exec(media_batch_stmt).all()

                # If no media is returned, we are done
                if not media_to_hash:
                    logger.info("No more media to hash. Task complete.")
                    break

                successful_hashes = 0
                for media in tqdm(media_to_hash, desc="Generating Hashes"):
                    # If a task is running, check for cancellation periodically
                    if task:
                        # Refresh the task object from the DB to get the latest status
                        session.refresh(task, attribute_names=["status"])
                        if task.status == "cancelled":
                            logger.warning(
                                f"Task {task_id} was cancelled. Aborting."
                            )
                            # Rollback any changes in the current uncommitted batch
                            session.rollback()
                            return

                    try:
                        # Generate the appropriate hash based on media type
                        suffix = (
                            Path(media.path).suffix.lower()
                            if media.path
                            else ""
                        )
                        media_type: Literal["image", "video"] = (
                            "video"
                            if suffix in settings.scan.VIDEO_SUFFIXES
                            else "image"
                        )
                        hash_value = generate_perceptual_hash(
                            media, type=media_type
                        )
                        if hash_value:
                            media.phash = hash_value
                            successful_hashes += 1
                        else:
                            media.phash = FAILURE_MARKER
                            logger.debug(
                                "No perceptual hash generated for media %s; marking as skipped",
                                media.id,
                            )
                        session.add(media)
                    except Exception as e:
                        logger.error(
                            f"Could not generate hash for media {media.id}: {e}"
                        )
                        media.phash = FAILURE_MARKER
                        session.add(media)

                # Update the task progress after processing each batch
                # Commit the changes for the current batch (media phashes and task progress)
                session.commit()
                logger.info(f"Committed batch of {len(media_to_hash)} hashes.")

                if task:
                    processed_so_far += successful_hashes
                    remaining_stmt = select(func.count(Media.id)).where(
                        Media.phash.is_(None),
                    )
                    remaining = session.exec(remaining_stmt).first() or 0
                    task.total = processed_so_far + remaining
                    task.processed = processed_so_far
                    session.add(task)
                    session.commit()


@router.post(
    "/clean_missing_files",
    summary="Scan for and delete records of files that no longer exist",
    response_model=ProcessingTask,
)
async def start_missing_files_cleanup(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    return create_and_run_task(
        session=session,
        background_tasks=background_tasks,
        task_type="clean_missing_files",
        callable_task=_clean_missing_files,
    )
