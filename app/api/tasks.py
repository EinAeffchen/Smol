from typing import List
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from sqlmodel import Session, select, func
import numpy as np
from datetime import datetime, timezone

from app.database import get_session, engine
from app.models import Media, Face, Person, ProcessingTask
from app.utils import detect_faces, create_embedding_for_face, process_file
from app.config import MEDIA_DIR, THUMB_DIR
from pathlib import Path
from app.config import (
    VIDEO_SUFFIXES,
    IMAGE_SUFFIXES,
    FACE_MATCH_COSINE_THRESHOLD,
)
from app.utils import logger


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
        .where(Media.faces_extracted == False)
    ).one()

    task = ProcessingTask(
        task_type="process_media",
        total=int(total),
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    logger.info("Starting processing!")
    background_tasks.add_task(_run_media_processing, task.id)
    return task


def _run_media_processing(task_id: str):
    sess = Session(engine)
    task = sess.get(ProcessingTask, task_id)
    task.status = "running"
    task.started_at = datetime.now(timezone.utc)
    sess.add(task)
    sess.commit()

    # iterate unprocessed media
    medias = sess.exec(
        select(Media).where(Media.faces_extracted == False)
    ).all()

    for media in medias:
        logger.info("Processing: %s", media.filename)
        # allow cancellation
        task = sess.get(ProcessingTask, task_id)
        if task.status == "cancelled":
            break

        full_path = MEDIA_DIR / media.path

        # 1) detect faces
        dets = detect_faces(str(full_path))
        for det in dets:
            face = Face(
                media_id=media.id,
                thumbnail_path=det["thumbnail_path"],
                bbox=det["bbox"],
            )
            sess.add(face)
        sess.commit()

        # 2) compute embeddings immediately
        query = select(Face).where(
            Face.media_id == media.id, Face.embedding.is_(None)
        )
        faces_to_embed = sess.exec(query).all()
        for face in faces_to_embed:
            try:
                emb = create_embedding_for_face(face)
                face.embedding = emb
                sess.add(face)
            except ValueError:
                logger.exception(
                    f"[process_media] embedding failed for face {face.id}. Removing file."
                )
                thumb_file: Path = THUMB_DIR / face.thumbnail_path
                if thumb_file.exists():
                    thumb_file.unlink()
                sess.delete(face)
        sess.commit()

        # 3) mark media done
        media.faces_extracted = True
        media.embeddings_created = True
        sess.add(media)

        # 4) update task progress
        task.processed += 1
        sess.add(task)
        sess.commit()

    # finalize
    task.status = "cancelled" if task.status == "cancelled" else "completed"
    task.finished_at = datetime.now(timezone.utc)
    sess.add(task)
    sess.commit()
    sess.close()


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
    session.commit()
    session.refresh(task)

    background_tasks.add_task(_run_person_clustering, task.id)
    return task


def _run_person_clustering(task_id: str):
    sess = Session(engine)
    task = sess.get(ProcessingTask, task_id)
    task.status = "running"
    task.started_at = datetime.now(timezone.utc)
    sess.add(task)
    sess.commit()

    # load existing persons
    persons = sess.exec(select(Person)).all()

    # fetch faces needing assignment
    faces = sess.exec(
        select(Face).where(Face.embedding != None, Face.person_id == None)
    ).all()

    def cosine_sim(a, b):
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

    for face in faces:
        # check cancellation
        task = sess.get(ProcessingTask, task_id)
        if task.status == "cancelled":
            break

        emb = np.array(face.embedding)
        assigned = False

        # try assign to existing person
        for person in persons:
            # get that person's embeddings
            embs = [np.array(f.embedding) for f in person.faces if f.embedding]
            if not embs:
                continue
            centroid = np.mean(embs, axis=0)
            if cosine_sim(centroid, emb) >= FACE_MATCH_COSINE_THRESHOLD:
                face.person_id = person.id
                assigned = True
                break

        # otherwise create a new Person
        if not assigned:
            new_p = Person()
            sess.add(new_p)
            sess.commit()
            sess.refresh(new_p)
            face.person_id = new_p.id
            persons.append(new_p)

        sess.add(face)
        sess.commit()

        # bump progress
        task.processed += 1
        sess.add(task)

        # ── AUTO‑ASSIGN DEFAULT PROFILE FACE ───────────────────────────────
        all_persons = sess.exec(select(Person)).all()
        for person in all_persons:
            if person.profile_face_id is None:
                # grab one face for this person
                first_face = sess.exec(
                    select(Face)
                    .where(Face.person_id == person.id)
                    .order_by(Face.id)
                ).first()
                if first_face:
                    person.profile_face_id = first_face.id
                    sess.add(person)
        sess.commit()

    # finalize
    task.status = "cancelled" if task.status == "cancelled" else "completed"
    task.finished_at = datetime.now(timezone.utc)
    sess.add(task)
    sess.commit()
    sess.close()


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
    session.commit()
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
    session.commit()
    session.refresh(task)

    # 3) enqueue the runner
    background_tasks.add_task(_run_scan, task.id, new_files)
    return task


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
