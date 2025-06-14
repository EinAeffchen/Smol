import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import hdbscan
import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from PIL import Image, UnidentifiedImageError
from sqlalchemy import or_
from sqlmodel import Session, delete, select, text, update
from tqdm import tqdm
from collections.abc import Callable
from app.api.media import delete_media_record
from app.config import (
    FACE_MATCH_COSINE_THRESHOLD,
    IMAGE_SUFFIXES,
    MEDIA_DIR,
    PERSON_MIN_FACE_COUNT,
    READ_ONLY,
    ENABLE_PEOPLE,
    VIDEO_SUFFIXES,
)
from app.database import engine, get_session, safe_commit
from app.logger import logger
from app.models import Face, Media, Person, PersonSimilarity, ProcessingTask
from app.processor_registry import processors
from app.utils import (
    complete_task,
    generate_thumbnails,
    get_person_embedding,
    process_file,
    split_video,
)
from typing import Literal

router = APIRouter()

# ─── 1) PROCESS MEDIA ─────────────────────────────────────────────────────────


def create_and_run_task(
    session: Session,
    background_tasks: BackgroundTasks,
    task_type: Literal["scan", "process_media", "cluster_persons"],
    task: Callable,
):
    """
    Creates a scan task in the database and adds the actual scan
    to the background tasks queue.
    """
    if READ_ONLY:
        raise HTTPException(
            status_code=403, detail="Not allowed in READ_ONLY mode."
        )

    # Check if a scan is already running to prevent overlap
    existing_task = session.exec(
        select(ProcessingTask).where(
            ProcessingTask.task_type == task_type,
            ProcessingTask.status == "running",
        )
    ).first()

    if existing_task:
        logger.info("Scan task is already running. Skipping new scan.")
        # Return the existing task instead of creating a new one
        return existing_task

    # Create a new task. The total will be updated later inside the task itself.
    task = ProcessingTask(task_type=task_type, total=0, processed=0)
    session.add(task)
    session.commit()
    session.refresh(task)

    # Enqueue the background runner
    background_tasks.add_task(task, task.id)
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
        task=_run_media_processing,
    )


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
    if ENABLE_PEOPLE:
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


def _run_media_processing(task_id: str):
    session = Session(engine)
    task = session.get(ProcessingTask, task_id)
    if not task:
        raise ValueError("Task with id %s not found!", task_id)
    task.status = "running"
    task.started_at = datetime.now(timezone.utc)

    # iterate unprocessed media
    medias = session.exec(
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
    task.total = len(medias)
    session.add(task)
    safe_commit(session)

    for proc in processors:
        proc.load_model()

    for media in medias:
        logger.info("Processing: %s", media.filename)
        # refresh task status to check for cancellation
        task = session.get(ProcessingTask, task_id)
        assert task

        if task.status == "cancelled":
            break
        full_path = MEDIA_DIR / media.path
        suffix = full_path.suffix.lower()
        if media.scenes or suffix in IMAGE_SUFFIXES:
            media.extracted_scenes = True
        if not media.extracted_scenes or suffix in IMAGE_SUFFIXES:
            if suffix in IMAGE_SUFFIXES:
                try:
                    scenes = [Image.open(full_path)]
                except UnidentifiedImageError:
                    logger.warning(
                        "Skipping %s, broken image file.", full_path
                    )
                    continue
                except FileNotFoundError:
                    delete_media_record(media.id, session)
                    logger.warning("Couldn't find file %s, deleting record")
                    continue
            else:
                scenes = split_video(media, full_path)
        else:
            scenes = media.scenes
        media.extracted_scenes = True
        session.add(media)
        safe_commit(session)
        for scene in scenes:
            if isinstance(scene, tuple):
                session.add(scene[0])
        safe_commit(session)

        broken = False
        for proc in processors:
            try:
                result = proc.process(media, session, scenes=scenes)
                if not result:
                    broken = True
                    break
            except Exception as e:
                logger.exception(
                    "processor %r failed on media %d with %s",
                    proc.name,
                    media.path,
                    e,
                )
        if not broken:
            session.add(media)
        broken = False
        # 4) update task progress
        task.processed += 1
        session.add(task)
        safe_commit(session)
    for proc in processors:
        proc.unload()

    # finalize
    task.status = "cancelled" if task.status == "cancelled" else "completed"
    task.finished_at = datetime.now(timezone.utc)
    session.add(task)
    safe_commit(session)
    session.close()


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
        task=run_person_clustering,
    )
    return task


def _fetch_faces_and_embeddings(session: Session):
    faces = session.exec(
        select(Face).where(Face.embedding != None, Face.person_id == None)
    ).all()
    embeddings = np.array(
        [np.array(face.embedding, dtype=np.float32) for face in faces]
    )
    return faces, embeddings


def _cluster_embeddings(
    embeddings: np.ndarray, min_cluster_size=5, min_samples=2
):
    clusterer = hdbscan.HDBSCAN(
        metric="euclidean",
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
    )
    labels = clusterer.fit_predict(embeddings)
    return labels


def _group_faces_by_cluster(
    labels: np.ndarray, faces: list[Face]
) -> dict[int, list[Face]]:
    clusters = defaultdict(list)
    for label, face in zip(labels, faces):
        if label != -1:  # exclude noise
            clusters[label].append(face)
    return clusters


def _assign_faces_to_clusters(
    clusters: dict[int, list[Face]], session: Session, task: ProcessingTask
):
    for faces in tqdm(clusters.values()):
        if len(faces) < PERSON_MIN_FACE_COUNT:
            continue

        new_person = Person(name=None)
        session.add(new_person)
        session.flush()  # get new_person.id

        embeddings = [face.embedding for face in faces]
        centroid = get_person_embedding(
            session=session,
            person_id=new_person.id,
            face_embeddings=embeddings,
        )
        embeddings = np.stack([np.array(emb) for emb in embeddings])

        similarities = embeddings @ centroid
        best_face = faces[np.argmax(similarities)]
        new_person.profile_face_id = best_face.id

        for face in faces:
            face.person_id = new_person.id
            session.add(face)

            # sync embeddings
            sql = text(
                """
                UPDATE face_embeddings SET person_id = :p_id
                WHERE face_id = :f_id
            """
            ).bindparams(p_id=new_person.id, f_id=face.id)
            session.exec(sql)

        person_embedding = centroid  # Already computed above
        sql = text(
            """
            INSERT OR REPLACE INTO person_embeddings(person_id, embedding)
            VALUES (:p_id, :emb)
        """
        ).bindparams(
            p_id=new_person.id, emb=json.dumps(person_embedding.tolist())
        )
        session.exec(sql)

        task.processed += len(faces)

        session.add(new_person)
        session.add(task)

    safe_commit(session)


def assign_to_existing_persons(
    session: Session,
    faces: list[Face],
    embs: np.ndarray,
    task: ProcessingTask,
    threshold: float,
) -> list[Face]:
    """
    For each face, do a vec0 nearest‐neighbor lookup in person_embeddings.
    If sim >= threshold, assign face.person_id and update face_embeddings.
    Otherwise keep it in 'unassigned' for later clustering.
    """
    unassigned: list[Face] = []

    for face, emb in zip(faces, embs):
        # turn your float32 vector into JSON (or raw bytes,
        # whichever your table expects)
        vec_param = json.dumps(emb.tolist())
        sql = text(
            """
                SELECT person_id, distance
                  FROM person_embeddings
                 WHERE embedding MATCH :vec
                 and K = 1
                 ORDER BY distance
            """
        ).bindparams(vec=vec_param)
        row = session.exec(sql).first()

        if row and row[1] <= threshold:
            # nearest person is good enough
            person_id = row[0]
            face.person_id = person_id
            session.add(face)

            sql = text(
                """
                   UPDATE face_embeddings 
                      SET person_id = :p_id
                    WHERE face_id   = :f_id
                """
            ).bindparams(p_id=person_id, f_id=face.id)
            # sync your face_embeddings table
            session.exec(sql)
        else:
            # not matched → keep for later clustering
            unassigned.append(face)

        task.processed += 1

        # commit periodically to avoid huge transactions
        if task.processed % 100 == 0:
            session.add(task)
            session.commit()

    # final commit of this pass
    session.add(task)
    session.commit()
    return unassigned


def unzip_faces_embeddings(faces: list[Face]):
    new_faces, embs = [], []
    for face in faces:
        new_faces.append(face)
        embs.append(face.embedding)
    return new_faces, embs


def run_person_clustering(task_id: str):
    with Session(engine) as session:
        task: ProcessingTask = session.get(ProcessingTask, task_id)
        task.status = "running"
        task.started_at = datetime.now(timezone.utc)

        faces, embeddings = _fetch_faces_and_embeddings(session)
        task.total = len(faces)
        session.add(task)
        safe_commit(session)

        if not faces:
            complete_task(session, task)
            return

        # Fetch embeddings once
        person = session.exec(select(Person).limit(1)).first()
        if person:
            unassigned_faces = assign_to_existing_persons(
                session,
                faces,
                embeddings,
                task,
                threshold=FACE_MATCH_COSINE_THRESHOLD,
            )
            if not unassigned_faces:
                complete_task(session, task)
                return
            new_faces, new_embs = unzip_faces_embeddings(unassigned_faces)
        else:
            new_faces = faces
            new_embs = embeddings

        if len(new_embs) > 5:
            labels = _cluster_embeddings(new_embs)

            clusters = _group_faces_by_cluster(labels, new_faces)

            _assign_faces_to_clusters(clusters, session, task)

        complete_task(session, task)


# ─── 3) CANCEL / LIST / GET TASKS ─────────────────────────────────────────────


@router.post("/{task_id}/cancel", summary="Cancel a running task")
def cancel_task(
    task_id: str,
    session: Session = Depends(get_session),
):
    if READ_ONLY:
        return HTTPException(
            status_code=403, detail="Not allowed in READ_ONLY mode."
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
    return session.exec(
        select(ProcessingTask).where(ProcessingTask.status == "running")
    ).all()


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
        task=_run_scan,
    )
    return task


# ─── 5) HELPER ─────────────────────────────────


@router.post("/reset/processing", summary="Resets media processing status")
def reset_processing(session: Session = Depends(get_session)):
    if READ_ONLY:
        return HTTPException(
            status_code=403, detail="Not allowed in READ_ONLY mode."
        )
    session.exec(update(Media).values(faces_extracted=False))
    session.exec(update(Media).values(embeddings_created=False))
    session.exec(text("DELETE FROM face_embeddings"))
    for face in tqdm(session.exec(select(Face)).all()):
        path = Path(face.thumbnail_path)
        if path.exists():
            path.unlink()
        session.exec(delete(Face).where(Face.id == face.id))
    safe_commit(session)
    return "OK"


@router.post("/reset/clustering", summary="Resets person clustering")
def reset_clustering(session: Session = Depends(get_session)):
    if READ_ONLY:
        return HTTPException(
            status_code=403, detail="Not allowed in READ_ONLY mode."
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


def _run_scan(task_id: str):
    sess = Session(engine)
    task = sess.get(ProcessingTask, task_id)

    assert task
    task.status = "running"
    sess.add(task)
    sess.commit()

    known_files = [row for row in sess.exec(select(Media.path)).all()]
    media_paths = []
    for root, dirs, files in tqdm(os.walk(MEDIA_DIR, topdown=True)):
        if ".smol" in dirs:
            dirs.remove(".smol")
        if ".DAV" in dirs:
            dirs.remove(".DAV")


        for fname in files:
            suffix = Path(fname).suffix.lower()
            full = Path(root) / fname
            rel = str(full.relative_to(MEDIA_DIR))
            if suffix not in VIDEO_SUFFIXES + IMAGE_SUFFIXES:
                continue
            if rel not in known_files:
                media_paths.append(rel)

    logger.info("Found %s new files", len(media_paths))
    task.total = len(media_paths)
    sess.add(task)
    sess.commit()

    if not media_paths:
        task.status = "completed"
        task.finished_at = datetime.now(timezone.utc)
        sess.add(task)
        sess.commit()
        sess.close()
        logger.info("No new files to process. Scan finished.")
        return

    medias = list()
    for i, filepath in tqdm(enumerate(media_paths)):
        # bail if cancelled
        medias.append(
            process_file(MEDIA_DIR / filepath)
        )  # you’ll extract the per‐file logic out of scan_folder
        if i % 100 == 0:
            task = sess.get(ProcessingTask, task_id)
            assert task
            if task.status == "cancelled":
                break
            task.processed += len(medias)
            sess.add(task)

    sess.add_all(medias)
    sess.flush()
    task.processed += len(medias)
    sess.add(task)
    for media in medias:
        if not generate_thumbnails(media):
            medias.remove(media)
    safe_commit(sess)
    medias.clear()

    task.status = "completed" if task.status != "cancelled" else "cancelled"
    task.finished_at = datetime.now(timezone.utc)
    sess.add(task)
    sess.commit()
    sess.close()
