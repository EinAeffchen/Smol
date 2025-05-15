import asyncio
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from PIL import Image, UnidentifiedImageError
from sklearn.cluster import DBSCAN
from sqlalchemy import or_
from sqlmodel import Session, delete, func, select, update, text
from tqdm import tqdm
from app.config import PERSON_MIN_FACE_COUNT
from app.api.media import delete_media_record

from app.config import (
    FACE_MATCH_COSINE_THRESHOLD,
    IMAGE_SUFFIXES,
    MEDIA_DIR,
    PERSON_MIN_FACE_COUNT,
    VIDEO_SUFFIXES,
)
from app.database import engine, get_session, safe_commit
from app.logger import logger
from app.models import Face, Media, Person, PersonSimilarity, ProcessingTask
from app.processor_registry import processors
from app.utils import (
    cosine_similarity,
    get_person_embedding,
    process_file,
    split_video,
)
import json

router = APIRouter()

# ─── 1) PROCESS MEDIA ─────────────────────────────────────────────────────────


@router.post(
    "/process_media",
    response_model=ProcessingTask,
    summary="Detect faces and compute embeddings for all unprocessed media",
)
async def start_media_processing(
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
    logger.error("Processing %s", total)
    task = ProcessingTask(
        task_type="process_media",
        total=int(total),
    )
    session.add(task)
    safe_commit(session)
    session.refresh(task)
    logger.info("Starting processing!")

    loop = asyncio.get_running_loop()
    loop.create_task(
        # asyncio.to_thread is Python 3.9+ shorthand for "run this sync fn in a thread"
        asyncio.to_thread(_run_media_processing, task.id)
    )
    return task


def _run_media_processing(task_id: str):
    session = Session(engine)
    task = session.get(ProcessingTask, task_id)
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

    for media in medias:
        logger.info("Processing: %s", media.filename)
        # allow cancellation
        task = session.get(ProcessingTask, task_id)
        if task.status == "cancelled":
            break

        full_path = MEDIA_DIR / media.path
        if media.scenes or full_path.suffix in IMAGE_SUFFIXES:
            media.extracted_scenes = True
        if not media.extracted_scenes or full_path.suffix in IMAGE_SUFFIXES:
            if full_path.suffix in IMAGE_SUFFIXES:
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

        for proc in processors:
            proc.load_model()

        for proc in processors:
            try:
                proc.process(media, session, scenes=scenes)
            except Exception as e:
                logger.exception(
                    "processor %r failed on media %d with %s",
                    proc.name,
                    media.id,
                    e,
                )
        session.add(media)
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
        orphans: list[Face] = session.exec(
            select(Face).where(Face.embedding != None, Face.person_id == None)
        ).all()
        if not orphans:
            return
        # load existing persons
        people = session.exec(select(Person.id)).all()
        if len(people) == 0:
            logger.warning("Found no people, clustering faces!")
            unassigned = [face.id for face in orphans]
            return cluster_unassigned_faces_into_new_persons(
                unassigned_ids=unassigned, session=session, task=task
            )

        prototypes: dict[int, np.ndarray] = {}
        for pid in people:
            emb = get_person_embedding(session, pid)
            if emb is not None:
                prototypes[pid] = emb

        unassigned = []
        task.total = len(orphans)
        task.processed = 0
        session.add(task)
        safe_commit(session)
        for face in tqdm(orphans):
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
                sql = text(
                    """
                        UPDATE face_embeddings SET person_id=:p_id
                        WHERE face_id=:f_id
                        """
                ).bindparams(p_id=best_pid, f_id=face.id)
                session.exec(sql)
            else:
                unassigned.append(face.id)
            task.processed += 1
            session.add(task)
            safe_commit(session)

        safe_commit(session)
        if not unassigned:
            task.status = (
                "cancelled" if task.status == "cancelled" else "completed"
            )
            task.finished_at = datetime.now(timezone.utc)
        session.add(task)
        safe_commit(session)
        cluster_unassigned_faces_into_new_persons(
            unassigned_ids=unassigned, session=session, task=task
        )
    return unassigned


def cluster_unassigned_faces_into_new_persons(
    unassigned_ids: list[int],
    task: ProcessingTask,
    session: Session | None = None,
    eps: float = 0.5,
    min_samples: int = PERSON_MIN_FACE_COUNT,
) -> None:
    """
    Run a DBSCAN over just the unassigned faces to create brand-new persons.
    Returns the list of newly‐created person IDs.
    """
    session = session or get_session()
    if not unassigned_ids:
        return

    faces: list[Face] = session.exec(
        select(Face).where(Face.id.in_(unassigned_ids))
    ).all()
    embs = np.stack([np.array(f.embedding, dtype=np.float32) for f in faces])
    ids = [f.id for f in faces]

    logger.warning("Starting clustering...")
    task.total = 0
    task.status = "running"
    clustering = DBSCAN(metric="cosine", eps=eps, min_samples=min_samples).fit(
        embs
    )
    labels = clustering.labels_
    task.total = len(set(labels))
    session.add(task)
    safe_commit(session)
    f_ids = [f.id for f in faces]
    for lbl in tqdm(set(labels)):
        if lbl < 0:
            continue
        cluster_face_ids = [fid for fid, l in zip(ids, labels) if l == lbl]

        if len(cluster_face_ids) < PERSON_MIN_FACE_COUNT:
            continue

        # 1. Create the person
        p = Person(name=None)
        session.add(p)
        session.flush()

        # 2. Assign cluster faces to person
        for face_id in cluster_face_ids:
            f = faces[f_ids.index(face_id)]
            f.person_id = p.id
            session.add(f)
            sql = text(
                """
                UPDATE face_embeddings SET person_id=:p_id
                WHERE face_id=:f_id
                """
            ).bindparams(p_id=p.id, f_id=f.id)
            session.exec(sql)

        # 3) Pick the profile face
        embs_subset = embs[[ids.index(fid) for fid in cluster_face_ids]]
        centroid = embs_subset.mean(axis=0)
        centroid /= np.linalg.norm(centroid)
        best_idx = np.argmax(embs_subset @ centroid)
        p.profile_face_id = cluster_face_ids[best_idx]
        session.add(p)

        person_embedding = get_person_embedding(session, p.id)
        sql = text(
            """
                INSERT OR REPLACE INTO person_embeddings(person_id, embedding)
                VALUES (:p_id, :emb)
                """
        ).bindparams(p_id=p.id, emb=json.dumps(person_embedding.tolist()))
        session.exec(sql)

        # 5. Final person + task commit
        task.processed += 1
        session.add(p)
        session.add(task)
        safe_commit(session)
    task.status = "completed"
    task.finished_at = datetime.now(timezone.utc)
    session.add(task)
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
    # 1) discover all NEW files
    new_files = []
    logger.info("Scanning %s...", MEDIA_DIR)

    # 2) make a ProcessingTask
    task = ProcessingTask(task_type="scan", total=len(new_files), processed=0)
    session.add(task)
    safe_commit(session)
    session.refresh(task)

    # 3) enqueue the runner
    background_tasks.add_task(_run_scan, task.id)
    return task


# ─── 5) HELPER ─────────────────────────────────


@router.post("/reset/processing", summary="Resets media processing status")
def reset_processing(session: Session = Depends(get_session)):
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
    session.exec(delete(PersonSimilarity))
    session.exec(update(Face).values(person_id=None))
    session.exec(delete(Person))
    session.exec(text("UPDATE face_embeddings SET person_id=-1"))
    safe_commit(session)
    return "OK"


def _run_scan(task_id: str):
    sess = Session(engine)
    task = sess.get(ProcessingTask, task_id)
    task.status = "running"
    sess.add(task)
    sess.commit()
    files = []
    for sub_path in MEDIA_DIR.iterdir():
        if sub_path.name == ".smol":
            continue
        if sub_path.is_dir():
            logger.info("Checking %s", sub_path)
        media_paths = sub_path.rglob(f"*.*")
        if sub_path.is_file():
            media_paths = [sub_path]
        for media_path in media_paths:
            if media_path.suffix not in IMAGE_SUFFIXES + VIDEO_SUFFIXES:
                continue
            logger.debug("Parsing %s", media_path)
            relative_path = media_path.relative_to(MEDIA_DIR)
            if (
                ".smol" in media_path.parts
                or sess.exec(
                    select(Media.id).where(Media.path == str(relative_path))
                ).first()
            ):
                continue
            files.append(media_path)
    task.total = len(files)
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
