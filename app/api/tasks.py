from datetime import datetime, timezone
from pathlib import Path
from typing import List

import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from PIL import Image
from sklearn.cluster import DBSCAN
from sqlalchemy import or_
from sqlmodel import Session, delete, func, select, update

from app.config import (
    FACE_MATCH_COSINE_THRESHOLD,
    IMAGE_SUFFIXES,
    MEDIA_DIR,
    VIDEO_SUFFIXES,
    PERSON_MIN_FACE_COUNT,
)
from app.database import engine, get_session, safe_commit
from app.models import Face, Media, Person, PersonSimilarity, ProcessingTask
from app.processor_registry import processors
from app.utils import (
    cosine_similarity,
    get_person_embedding,
    logger,
    process_file,
    split_video,
)

router = APIRouter()

# ─── 1) PROCESS MEDIA ─────────────────────────────────────────────────────────


@router.post(
    "/process_media",
    response_model=ProcessingTask,
    summary="Detect faces and compute embeddings for all unprocessed media",
)
def start_media_processing(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    # count all media that still need processing
    total = session.exec(
        select(func.count())
        .select_from(Media)
        .where(
            or_(
                Media.faces_extracted.is_(False),
                Media.ran_auto_tagging.is_(False),
                Media.embeddings_created.is_(False),
            )
        )
    ).one()

    task = ProcessingTask(
        task_type="process_media",
        total=int(total),
    )
    session.add(task)
    safe_commit(session)
    session.refresh(task)
    logger.info("Starting processing!")
    background_tasks.add_task(_run_media_processing, task.id)
    return task


def _run_media_processing(task_id: str):
    logger.info("Processing with %s", [p.name for p in processors])
    session = Session(engine)
    task = session.get(ProcessingTask, task_id)
    task.status = "running"
    task.started_at = datetime.now(timezone.utc)
    session.add(task)
    safe_commit(session)

    # iterate unprocessed media
    medias = session.exec(
        select(Media).where(
            or_(
                Media.faces_extracted.is_(False),
                Media.ran_auto_tagging.is_(False),
                Media.embeddings_created.is_(False),
            )
        )
    ).all()

    for media in medias:
        logger.info("Processing: %s", media.filename)
        # allow cancellation
        task = session.get(ProcessingTask, task_id)
        if task.status == "cancelled":
            break

        full_path = MEDIA_DIR / media.path
        if full_path.suffix in IMAGE_SUFFIXES:
            scenes = [Image.open(full_path)]
        else:
            scenes = split_video(media, full_path)

        for scene in scenes:
            logger.debug(scenes)
            if isinstance(scene, tuple):
                session.add(scene[0])
        safe_commit(session)

        for proc in processors:
            proc.load_model()

        for proc in processors:
            logger.info("Running Processor: %s", proc.name)
            try:
                proc.process(media, session, scenes=scenes)
            except Exception:
                logger.exception(
                    "processor %r failed on media %d", proc.name, media.id
                )
        for proc in processors:
            proc.unload()
        # 4) update task progress
        task.processed += 1
        session.add(task)
        safe_commit(session)

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
    # count faces without a person_id
    total = session.exec(
        select(func.count())
        .select_from(Face)
        .where(Face.embedding != None, Face.person_id == None)
    ).one()

    task = ProcessingTask(
        task_type="cluster_persons",
        total=int(total),
    )
    session.add(task)
    safe_commit(session)
    session.refresh(task)

    background_tasks.add_task(_run_person_clustering, task.id)
    return task


def _run_person_clustering(task_id: str):
    with Session(engine) as session:
        task: ProcessingTask = session.get(ProcessingTask, task_id)
        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        session.add(task)
        session.commit()

        # fetch faces needing assignment
        orphans: List[Face] = session.exec(
            select(Face).where(Face.embedding != None, Face.person_id == None)
        ).all()
        if not orphans:
            return
        # load existing persons
        people = session.exec(select(Person.id)).all()

        prototypes: dict[int, np.ndarray] = {}
        for pid in people:
            emb = get_person_embedding(session, pid)
            if emb is not None:
                prototypes[pid] = emb

        unassigned = []

        for face in orphans:
            emb = np.array(face.embedding, dtype=np.float32)
            # find best match
            best_pid, best_sim = None, 0.0
            for pid, proto in prototypes.items():
                sim = cosine_similarity(proto, emb)
                if sim > best_sim:
                    best_sim, best_pid = sim, pid

            if (
                best_pid is not None
                and best_sim >= FACE_MATCH_COSINE_THRESHOLD
            ):
                face.person_id = best_pid
                session.add(face)
            else:
                unassigned.append(face.id)

        safe_commit(session)
        task.status = (
            "cancelled" if task.status == "cancelled" else "completed"
        )
        task.finished_at = datetime.now(timezone.utc)
        session.add(task)
        safe_commit(session)
        cluster_unassigned_faces_into_new_persons(unassigned, session)
    return unassigned


def cluster_unassigned_faces_into_new_persons(
    unassigned_ids: List[int],
    session: Session | None = None,
    eps: float = 0.5,
    min_samples: int = 1,
) -> List[int]:
    """
    Run a DBSCAN over just the unassigned faces to create brand-new persons.
    Returns the list of newly‐created person IDs.
    """
    session = session or get_session()
    if not unassigned_ids:
        return []

    faces: List[Face] = session.exec(
        select(Face).where(Face.id.in_(unassigned_ids))
    ).all()
    embs = np.stack([np.array(f.embedding, dtype=np.float32) for f in faces])
    ids = [f.id for f in faces]

    clustering = DBSCAN(metric="cosine", eps=eps, min_samples=min_samples).fit(
        embs
    )
    labels = clustering.labels_

    for lbl in set(labels):
        if lbl < 0:
            continue
        cluster_face_ids = [fid for fid, l in zip(ids, labels) if l == lbl]
        
        if len(cluster_face_ids) < PERSON_MIN_FACE_COUNT:
            continue
        # create a Person
        p = Person(name=None)
        session.add(p)
        safe_commit(session)
        session.refresh(p)

        # assign cluster faces
        for f in faces:
            if f.id in cluster_face_ids:
                f.person_id = p.id
                session.add(f)
                p.profile_face_id = f.id
        session.add(p)
        safe_commit(session)


# ─── 3) CANCEL / LIST / GET TASKS ─────────────────────────────────────────────


@router.post("/{task_id}/cancel", summary="Cancel a running task")
def cancel_task(
    task_id: str,
    session: Session = Depends(get_session),
):
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


@router.get("/", response_model=List[ProcessingTask], summary="List all tasks")
def list_tasks(session: Session = Depends(get_session)):
    return session.exec(select(ProcessingTask)).all()


@router.get(
    "/active",
    response_model=List[ProcessingTask],
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
    # 1) discover all NEW files
    new_files = []
    for media_type in VIDEO_SUFFIXES + IMAGE_SUFFIXES:
        for path in MEDIA_DIR.rglob(f"*{media_type}"):
            relative_path = path.relative_to(MEDIA_DIR)
            if (
                ".smol" in path.parts
                or session.exec(
                    select(Media.id).where(Media.path == str(relative_path))
                ).first()
            ):
                continue
            new_files.append(path)

    # 2) make a ProcessingTask
    task = ProcessingTask(task_type="scan", total=len(new_files), processed=0)
    session.add(task)
    safe_commit(session)
    session.refresh(task)

    # 3) enqueue the runner
    background_tasks.add_task(_run_scan, task.id, new_files)
    return task


# ─── 5) HELPER ─────────────────────────────────


@router.post("/reset/processing", summary="Resets media processing status")
def reset_processing(session: Session = Depends(get_session)):
    session.exec(update(Media).values(faces_extracted=False))
    for face in session.exec(select(Face)).all():
        path = Path(face.thumbnail_path)
        if path.exists():
            path.unlink()
        session.exec(delete(Face).where(Face.id == face.id))
    safe_commit(session)
    return "OK"


@router.post("/reset/clustering", summary="Resets person clustering")
def reset_clustering(session: Session = Depends(get_session)):
    session.exec(update(Media).values(embeddings_created=False))
    session.exec(delete(PersonSimilarity))
    session.exec(update(Face).values(person_id=None))
    session.exec(delete(Person))
    safe_commit(session)
    return "OK"


def _run_scan(task_id: str, files: list[Path]):
    sess = Session(engine)
    task = sess.get(ProcessingTask, task_id)
    task.status = "running"
    sess.add(task)
    sess.commit()

    for filepath in files:
        # bail if cancelled
        task = sess.get(ProcessingTask, task_id)
        if task.status == "cancelled":
            break

        # insert into DB + thumbnail
        process_file(
            filepath
        )  # you’ll extract the per‐file logic out of scan_folder
        task.processed += 1
        sess.add(task)
        sess.commit()

    task.status = "completed" if task.status != "cancelled" else "cancelled"
    task.finished_at = datetime.now(timezone.utc)
    sess.add(task)
    sess.commit()
    sess.close()
