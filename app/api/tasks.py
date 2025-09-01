import json
import os
import time
from collections import defaultdict
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import hdbscan
import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, or_
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, delete, select, text, update
from tqdm import tqdm

from app.api.media import delete_record
from app.config import settings
from app.database import engine, get_session, safe_commit
from app.logger import logger
from app.models import (
    DuplicateMedia,
    Face,
    Media,
    Person,
    PersonSimilarity,
    ProcessingTask,
)
from app.processor_registry import load_processors, processors
from app.processors.duplicates import DuplicateProcessor
from app.utils import (
    complete_task,
    generate_perceptual_hash,
    generate_thumbnail,
    get_image_taken_date,
    process_file,
    split_video,
)

router = APIRouter()

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
    except OperationalError:
        logger.warning(f"Database currently busy, skipping {task_type}.")
        return

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
    with Session(engine) as new_session:
        next_task = ProcessingTask(task_type="scan", total=0, processed=0)
        new_session.add(next_task)
        new_session.commit()
        new_session.refresh(next_task)

        # Call the next worker in the chain
        _run_scan_and_chain(next_task.id)


def _run_scan_and_chain(task_id: str):
    _run_scan(task_id)

    logger.info("Scan task finished, starting media processing task.")
    with Session(engine) as new_session:
        next_task = ProcessingTask(
            task_type="process_media", total=0, processed=0
        )
        new_session.add(next_task)
        new_session.commit()
        new_session.refresh(next_task)

        # Call the next worker in the chain
        _run_media_processing_and_chain(next_task.id)


def _run_media_processing_and_chain(task_id: str):
    _run_media_processing(task_id)

    logger.info("Media processing finished.")
    if settings.general.enable_people and settings.scan.auto_cluster_on_scan:
        logger.info("Starting Person Clustering...")
        with Session(engine) as new_session:
            next_task = ProcessingTask(
                task_type="cluster_persons", total=0, processed=0
            )
            new_session.add(next_task)
            new_session.commit()
            new_session.refresh(next_task)

            run_person_clustering(next_task.id)  # Call the final worker
    logger.info("Task chain completed")


def _get_media_to_process(session: Session) -> list[Media]:
    """Fetches all media records that require processing."""
    return session.exec(
        select(Media)
        .where(
            or_(
                Media.faces_extracted.is_(False),
                Media.ran_auto_tagging.is_(False),
                Media.embeddings_created.is_(False),
                Media.extracted_scenes.is_(False),
            )
        )
        .order_by(Media.duration.asc())
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
                return False  # Stop processing this media item on failure
        except Exception as e:
            logger.exception(
                "Processor '%s' raised an exception on media %s: %s",
                proc.name,
                media.path,
                e,
            )
            return False
    return True


def _run_media_processing(task_id: str):
    with Session(engine) as session:
        task = session.get(ProcessingTask, task_id)
        if not task:
            logger.error("Task with id %s not found!", task_id)
            return

        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        medias_to_process = _get_media_to_process(session)
        task.total = len(medias_to_process)
        session.add(task)
        safe_commit(session)

        # Ensure processors are loaded (in case lifespan didn't run yet)
        if not processors:
            logger.debug("Processor registry empty; loading processors now.")
            load_processors()

        for proc in processors:
            proc.load_model()

        for media in medias_to_process:
            session.refresh(task)  # Check for cancellation
            if task.status == "cancelled":
                logger.info("Task cancelled. Stopping processing.")
                break

            logger.info("Processing: %s", media.filename)

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

            all_processors_succeeded = _apply_processors(
                media, scenes, session
            )

            if all_processors_succeeded:
                session.add(media)  # Add the updated media object

            task.processed += 1
            session.add(task)
            safe_commit(
                session
            )  # Commit after each media item is fully processed

        # 4. Unload Models
        for proc in processors:
            proc.unload()

        # 5. Finalize Task
        session.refresh(task)  # Get final status before updating
        task.status = (
            "completed" if task.status != "cancelled" else "cancelled"
        )
        task.finished_at = datetime.now(timezone.utc)
        session.add(task)
        safe_commit(session)


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
    results = session.exec(
        select(Face.id, Face.embedding)
        .where(
            Face.embedding.is_not(None),
            Face.person_id.is_(None),
            Face.id > last_id,
        )
        .order_by(Face.id.asc())
        .limit(limit)
    ).all()

    if not results:
        return [], np.array([])

    face_ids, embeddings_list = zip(*results)

    embeddings = np.array(embeddings_list, dtype=np.float32)

    return list(face_ids), embeddings


def _cluster_embeddings(
    embeddings: np.ndarray, min_cluster_size=6, min_samples=10
):
    embeddings_64 = embeddings.astype(np.float64)
    clusterer = hdbscan.HDBSCAN(
        metric="cosine",
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        cluster_selection_method="eom",
        cluster_selection_epsilon=0.15,
        algorithm="generic",
    )
    labels = clusterer.fit_predict(embeddings_64)
    return labels


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
):
    for face_ids, embeddings in tqdm(clusters.values()):
        if len(face_ids) < settings.face_recognition.person_min_face_count:
            continue

        embeddings_arr = np.array(embeddings)
        centroid = embeddings_arr.mean(axis=0)
        similarities = embeddings_arr @ centroid

        best_face_id = face_ids[np.argmax(similarities)]

        # Each cluster gets its own self-contained transaction
        with Session(engine) as session:
            task = session.get(ProcessingTask, task_id)
            if task.status == "cancelled":
                break
            media_count = session.exec(
                select(func.count(func.distinct(Face.media_id))).where(
                    Face.id.in_(face_ids)
                )
            ).one()
            new_person = Person(
                name=None,
                profile_face_id=best_face_id,
                appearance_count=media_count,
            )
            session.add(new_person)
            session.flush()  # Get new_person.id

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
            sql_person_emb = text(
                """
                INSERT INTO person_embeddings(person_id, embedding)
                VALUES (:p_id, :emb)
                """
            ).bindparams(p_id=new_person.id, emb=json.dumps(centroid.tolist()))
            session.exec(sql_person_emb)

            task.processed += len(face_ids)
            session.add(task)
            safe_commit(session)


def assign_to_existing_persons(
    face_ids: list[int], embs: np.ndarray, task_id: str, threshold: float
) -> list[int]:
    """
    For each face, do a vec0 nearest‐neighbor lookup in person_embeddings.
    If sim >= threshold, assign face.person_id and update face_embeddings.
    Otherwise keep it in 'unassigned' for later clustering.
    """
    unassigned: list[int] = []

    with Session(engine) as session:
        for face_id, emb in tqdm(zip(face_ids, embs), total=len(face_ids)):
            face = session.get(Face, face_id)
            task = session.get(ProcessingTask, task_id)
            assert task

            if task.status == "cancelled":
                break

            vec_param = json.dumps(emb.tolist())
            sql = text(
                """
                    SELECT person_id, distance
                      FROM person_embeddings
                     WHERE embedding MATCH :vec
                     ORDER BY distance
                     LIMIT 1
                """
            ).bindparams(vec=vec_param)
            row = session.exec(sql).first()

            if row and row[1] <= threshold:
                # nearest person is good enough
                person_id = row[0]
                if not person_id:
                    sql = text("""DELETE FROM person_embeddings
                                WHERE person_id=:p_id""").bindparams(
                        p_id=person_id
                    )
                    session.exec(sql)
                    return
                face.person_id = person_id
                session.add(face)

                sql = text(
                    """
                    UPDATE face_embeddings 
                        SET person_id = :p_id
                        WHERE face_id   = :f_id
                    """
                ).bindparams(p_id=person_id, f_id=face.id)
                person = session.get(Person, person_id)
                person.appearance_count += 1
                session.exec(sql)
            else:
                unassigned.append(face_id)

            task.processed += 1

            # commit periodically to avoid huge transactions
            if task.processed % 100 == 0:
                session.add(task)
                safe_commit(session)

        session.add(task)
        safe_commit(session)
    return unassigned


def unzip_faces_embeddings(faces: list[Face]):
    new_faces, embs = [], []
    for face in faces:
        new_faces.append(face)
        embs.append(face.embedding)
    return new_faces, embs


def _get_face_total(session: Session):
    return session.exec(
        select(func.count(Face.id)).where(
            Face.embedding != None, Face.person_id == None
        )
    ).first()


def run_person_clustering(task_id: str):
    with Session(engine) as session:
        task = session.get(ProcessingTask, task_id)
        if not task:
            logger.error("Task %s not found.", task_id)
            return

        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        task.total = _get_face_total(session)
        logger.info("Got %s faces to cluster!", task.total)
        safe_commit(session)
    last_id = 0
    while True:
        logger.info("--- Starting new Clustering Batch ---")
        with Session(engine) as session:
            logger.debug("Continuing from id: %s", last_id)
            batch_face_ids, batch_embeddings = _fetch_faces_and_embeddings(
                session, last_id=last_id, limit=settings.ai.cluster_batch_size
            )
            last_id = batch_face_ids[-1]

        if len(batch_face_ids) == 0:
            logger.info("No more unassigned faces found. Finishing process.")
            break  # Exit the while loop

        logger.info("Processing batch of %d faces...", len(batch_face_ids))

        # Fetch embeddings once
        person_exists = False
        with Session(engine) as session:  # Quick, read-only check
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

        if len(new_embs) > 6:
            labels = _cluster_embeddings(new_embs)
            clusters = _group_faces_by_cluster(labels, new_faces_ids, new_embs)
            logger.debug("Created %s Persons!", len(clusters))
            _assign_faces_to_clusters(clusters, task_id)
        if len(batch_face_ids) < settings.ai.cluster_batch_size:
            break

    with Session(engine) as session:
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
    response_model=list[ProcessingTask],
    summary="List all active tasks",
)
def list_active_tasks(session: Session = Depends(get_session)):
    try:
        return session.exec(
            select(ProcessingTask).where(ProcessingTask.status == "running")
        ).all()
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
    # TODO add auto-cleanup with options (keep oldest, newest, biggest, smallest)
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
    with Session(engine) as session:
        task = session.get(ProcessingTask, task_id)
        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        session.commit()
    generate_hashes(task_id)
    processor = DuplicateProcessor(task_id, threshold)
    processor.process()

    # Clean up any empty duplicate groups that were created
    with Session(engine) as session:
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
    """Background task to scan for and delete records of missing files"""
    with Session(engine) as session:
        task = session.get(ProcessingTask, task_id)
        if not task:
            logger.error("Task %s not found", task_id)
            return

        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        task.total = session.exec(
            select(func.count()).select_from(Media)
        ).first()
        session.commit()

        deleted_count = 0
        batch_size = 100
        offset = 0

        while True:
            media_batch = session.exec(
                select(Media).offset(offset).limit(batch_size)
            ).all()

            if not media_batch:
                break

            for media in media_batch:
                if not Path(media.path).exists():
                    delete_record(media.id, session)
                    deleted_count += 1
                    logger.info(
                        "Deleted record for missing file: %s", media.path
                    )

            offset += batch_size
            task.processed = offset
            session.commit()

        task.status = "completed"
        task.finished_at = datetime.now(timezone.utc)
        session.commit()
        logger.info("Cleaned %d missing file records", deleted_count)


def _run_scan(task_id: str):
    with Session(engine) as sess:
        task = sess.get(ProcessingTask, task_id)

        if not task:
            logger.error("Task %s not found.", task_id)
            return

        task.status = "running"
        task.started_at = datetime.now()
        safe_commit(sess)

        known_files = set(sess.exec(select(Media.path)).all())
    media_paths = []
    for media_dir in settings.general.media_dirs:
        for root, dirs, files in tqdm(
            os.walk(media_dir, topdown=True, followlinks=True)
        ):
            if ".smol" in dirs:
                dirs.remove(".smol")

            for fname in files:
                suffix = Path(fname).suffix.lower()
                full = (Path(root) / fname).resolve()
                if (
                    suffix
                    not in settings.scan.VIDEO_SUFFIXES
                    + settings.scan.IMAGE_SUFFIXES
                ):
                    continue
                if str(full) not in known_files:
                    media_paths.append(full)
                    known_files.add(str(full))

    logger.info("Found %s new files", len(media_paths))

    with Session(engine) as sess:
        task = sess.merge(task)
        task.total = len(media_paths)
        logger.info("Set total to %s", task.total)
        safe_commit(sess)

        if not media_paths:
            task.status = "completed"
            task.finished_at = datetime.now(timezone.utc)
            logger.info("No new files to process. Scan finished.")
            safe_commit(sess)
            return

    medias_to_add: list[Media] = list()
    for i, filepath in tqdm(enumerate(media_paths, 1)):
        if i % 100 == 0:
            with Session(engine) as sess:
                task = sess.get(ProcessingTask, task_id)
                task.processed += 100
                task = sess.merge(task)
                if task and task.status == "cancelled":
                    break
                safe_commit(sess)

        media_obj = process_file(filepath)
        if media_obj:
            medias_to_add.append(media_obj)

    with Session(engine) as sess:
        task = sess.merge(task)
        sess.add_all(medias_to_add)
        sess.flush(medias_to_add)
        broken_files = []
        for media in medias_to_add:
            thumbnail_path = generate_thumbnail(media)
            if not thumbnail_path:
                broken_files.append(thumbnail_path)
                continue
            media.thumbnail_path = thumbnail_path
        for broken_media in broken_files:
            sess.delete(broken_media)
        task.processed = len(medias_to_add)
        task.status = (
            "completed" if task.status != "cancelled" else "cancelled"
        )
        task.finished_at = datetime.now(timezone.utc)
        safe_commit(sess)


def generate_hashes(task_id: int | None = None):
    """A task to find all media without a pHash and generate one."""
    BATCH_SIZE = 10
    with Session(engine) as session:
        task = session.get(ProcessingTask, task_id) if task_id else None
        logger.info("Got task!")
        # If there's a task, get the initial total count
        if task:
            count_stmt = select(func.count(Media.id)).where(
                Media.phash.is_(None)
            )
            total_count = session.exec(count_stmt).first()
            logger.info("SET count to %s", total_count)
            task.total = total_count
            session.commit()  # Commit the initial total count

        while True:
            # Fetch a batch of media objects that need a hash
            media_batch_stmt = (
                select(Media).where(Media.phash.is_(None)).limit(BATCH_SIZE)
            )
            media_to_hash = session.exec(media_batch_stmt).all()

            # If no media is returned, we are done
            if not media_to_hash:
                logger.info("No more media to hash. Task complete.")
                break

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
                    if media.duration is None:
                        media.phash = generate_perceptual_hash(
                            media, type="image"
                        )
                    else:
                        media.phash = generate_perceptual_hash(
                            media, type="video"
                        )
                    session.add(media)
                except Exception as e:
                    logger.error(
                        f"Could not generate hash for media {media.id}: {e}"
                    )

            # Update the task progress after processing each batch
            if task:
                task.processed += len(media_to_hash)

            # Commit the changes for the current batch (media phashes and task progress)
            session.commit()
            logger.info(f"Committed batch of {len(media_to_hash)} hashes.")


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
