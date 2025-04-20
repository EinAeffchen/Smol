from typing import List, Optional
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Body
from sqlmodel import select, Session
from datetime import datetime, timezone

from app.database import get_session, engine
from app.models import Media, Face, ProcessingTask
from app.utils import scan_folder
from app.config import MEDIA_DIR
from app import utils
from pathlib import Path

router = APIRouter()


@router.post("/scan", summary="Re-scan volume and insert new Media rows")
def api_scan(session: Session = Depends(get_session)):
    scan_folder()
    return {"detail": "scan complete"}


@router.post(
    "/extract_faces",
    response_model=ProcessingTask,
    summary="Start face detection for all (or provided) media",
)
def start_face_extraction(
    background_tasks: BackgroundTasks,
    media_ids: Optional[List[int]] = Body(None),
    session: Session = Depends(get_session),
):
    # select target media
    q = select(Media).where(Media.faces_extracted == False)
    if media_ids:
        q = q.where(Media.id.in_(media_ids))
    to_do = session.exec(q).all()
    task = ProcessingTask(
        task_type="extract_faces",
        total=len(to_do),
    )
    session.add(task)
    session.commit()
    session.refresh(task)

    background_tasks.add_task(
        _run_face_extraction, task.id, [m.id for m in to_do]
    )
    return task


def _run_face_extraction(task_id: str, media_ids: List[int]):
    sess = Session(engine)
    task = sess.get(ProcessingTask, task_id)
    task.status = "running"
    task.started_at = datetime.now(timezone.utc)
    sess.add(task)
    sess.commit()

    for mid in media_ids:
        task = sess.get(ProcessingTask, task_id)
        if task.status == "cancelled":
            break

        media = sess.get(Media, mid)
        faces = utils.detect_faces(str(MEDIA_DIR.absolute() / media.path))
        # faces is a list of dicts e.g. [{"bbox":(...), "thumbnail":"/smol/thumbnails/..."}, ...]
        for f in faces:
            face = Face(media_id=mid, embedding=None, **f)
            sess.add(face)
        media.faces_extracted = True
        sess.add(media)

        task.processed = 1
        sess.add(task)
        sess.commit()

    task.status = "completed" if task.status != "cancelled" else "cancelled"
    task.finished_at = datetime.now(timezone.utc)
    sess.add(task)
    sess.commit()
    sess.close()


@router.post(
    "/create_embeddings",
    response_model=ProcessingTask,
    summary="Compute embeddings for all freshly extracted faces",
)
def start_embedding_creation(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    faces = session.exec(select(Face).where(Face.embedding == None)).all()
    task = ProcessingTask(
        task_type="create_embeddings",
        total=len(faces),
    )
    session.add(task)
    session.commit()
    session.refresh(task)

    background_tasks.add_task(
        _run_embedding_creation, task.id, [f.id for f in faces]
    )
    return task


def _run_embedding_creation(task_id: str, face_ids: List[int]):
    sess = Session(engine)
    task = sess.get(ProcessingTask, task_id)
    task.status = "running"
    task.started_at = datetime.now(timezone.utc)
    sess.add(task)
    sess.commit()

    for fid in face_ids:
        task = sess.get(ProcessingTask, task_id)
        if task.status == "cancelled":
            break

        face = sess.get(Face, fid)
        emb = utils.create_embedding_for_face(face)  # you implement this
        face.embedding = emb
        sess.add(face)

        task.processed = 1
        sess.add(task)
        sess.commit()

    task.status = "completed"
    task.finished_at = datetime.now(timezone.utc)
    sess.add(task)
    sess.commit()
    sess.close()


@router.get(
    "/",
    response_model=List[ProcessingTask],
    summary="List all processing tasks",
)
def list_tasks(session: Session = Depends(get_session)):
    return session.exec(select(ProcessingTask)).all()


@router.get(
    "/active",
    response_model=List[ProcessingTask],
    summary="List all processing tasks",
)
def list_active_tasks(session: Session = Depends(get_session)):
    return session.exec(
        select(ProcessingTask).where(
            ProcessingTask.status != "cancelled",
            ProcessingTask.status != "finished",
        )
    ).all()


@router.get(
    "/{task_id}",
    response_model=ProcessingTask,
    summary="Get a single task status",
)
def get_task(task_id: str, session: Session = Depends(get_session)):
    task = session.get(ProcessingTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


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
