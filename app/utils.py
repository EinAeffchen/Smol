import os
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path

import cv2

from fastapi import HTTPException
import ffmpeg
import numpy as np
import piexif
from PIL import Image, UnidentifiedImageError, ImageOps
from scenedetect import AdaptiveDetector, detect
from scenedetect.video_splitter import TimecodePair
from sqlmodel import Session, select
from tqdm import tqdm
from sqlalchemy import delete, text
import json
import imagehash


from app.config import (
    MAX_FRAMES_PER_VIDEO,
    MEDIA_DIR,
    THUMB_DIR,
    THUMB_DIR_FOLDER_SIZE,
    VIDEO_SUFFIXES,
    AUTO_ROTATE,
)
from app.database import engine, safe_commit
from app.logger import logger
from app.models import (
    ExifData,
    Face,
    Media,
    MediaTagLink,
    Person,
    PersonSimilarity,
    Scene,
    DuplicateMedia,
    ProcessingTask,
)


def process_file(filepath: Path) -> Media:
    with Session(engine) as session:
        try:
            probe = ffmpeg.probe(filepath)
        except Exception as e:
            logger.error("Can't process %s", filepath)
            return
        size = os.path.getsize(filepath)
        if filepath.suffix.lower() in VIDEO_SUFFIXES:
            duration = float(probe["format"].get("duration", 0))
        else:
            duration = None
        creation_timestamp = filepath.stat().st_dev or filepath.stat().st_mtime
        creation_date = datetime.fromtimestamp(
            creation_timestamp, timezone.utc
        )
        vs = [s for s in probe["streams"] if s.get("codec_type") == "video"]
        width = int(vs[0]["width"]) if vs else None
        height = int(vs[0]["height"]) if vs else None
        media = Media(
            path=str(filepath.relative_to(MEDIA_DIR)),
            filename=filepath.name,
            size=size,
            duration=duration,
            width=width,
            height=height,
            faces_extracted=False,
            embeddings_created=False,
            created_at=creation_date,
            embedding=None,
        )
        if media.duration is None:
            media.phash = generate_perceptual_hash(media)
        return media


def get_thumb_folder(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    folders = [folder for folder in path.iterdir() if folder.is_dir()]
    if not folders:
        new_folder = path / "1"
        new_folder.mkdir()
        return new_folder
    else:
        folders.sort(key=lambda p: int(p.name))
        latest = folders[-1]
        file_count = sum(1 for file in latest.iterdir() if file.is_file())
        if file_count >= THUMB_DIR_FOLDER_SIZE:
            new_folder = path / str(int(latest.name) + 1)
            new_folder.mkdir(exist_ok=True)
            return new_folder
        return latest


def fix_image_rotation(full_path: Path) -> None:
    if not AUTO_ROTATE:
        return

    img = Image.open(full_path)
    exif = img.getexif()
    orientation = exif.get(274)
    if not orientation or orientation == 1:
        return
    try:
        transposed = ImageOps.exif_transpose(img)
    except OSError:
        logger.warning(
            "Image: %s is truncated, you might want to delete it.", full_path
        )
        return
    del exif[274]
    exif_bytes = exif.tobytes()
    transposed.save(full_path, format=img.format, exif=exif_bytes)


def generate_perceptual_hash(media: Media) -> str:
    full_path = MEDIA_DIR / media.path
    try:
        img = Image.open(full_path)
    except UnidentifiedImageError:
        logger.warning("Skipping %s, not an image!", media.path)
    try:
        return str(imagehash.phash(img))
    except OSError:
        logger.warning("Image %s is truncated and can't be processed:", media.path)


def generate_thumbnail(media: Media) -> str | None:
    thumb_folder = get_thumb_folder(THUMB_DIR / "media")
    thumb_path = thumb_folder / f"{media.id}.jpg"
    filepath = Path(media.path)
    full_path = MEDIA_DIR / filepath
    if filepath.suffix.lower() in VIDEO_SUFFIXES:
        (
            ffmpeg.input(str(full_path), ss=1)
            .filter("scale", 360, -1)
            .output(str(thumb_path), vframes=1)
            .run(quiet=True, overwrite_output=True)
        )
    else:
        try:
            fix_image_rotation(full_path)
            img = Image.open(full_path)
            img = ImageOps.exif_transpose(img)
        except UnidentifiedImageError:
            logger.warning("Couldn't open %s", filepath)
            return
        except OSError as e:
            logger.warning(
                "Failed to process image %s, because of: %s", filepath, e
            )
            return
        img.thumbnail((360, -1))
        try:
            img.save(thumb_path, format="JPEG")
        except OSError:
            img = img.convert("RGB")
            img.save(thumb_path, format="JPEG")

        assert thumb_path.is_file()
    return str(thumb_path.relative_to(THUMB_DIR))


def get_person_embedding(
    session: Session,
    person_id: int,
    face_embeddings: list | None = None,
    new: bool = False,
) -> str | bytes | None:
    if not face_embeddings:
        if not new:
            person_embedding = session.exec(
                text(
                    "SELECT embedding FROM person_embeddings WHERE person_id=:p_id"
                ).bindparams(p_id=person_id)
            ).first()
            if person_embedding:
                # returns bytes
                return person_embedding[0]

        face_embeddings = session.exec(
            select(Face.embedding).where(
                Face.person_id == person_id, Face.embedding != None
            )
        ).all()

    if not face_embeddings:
        logger.warning(f"No embeddings found for person {person_id}")
        return

    embeddings_array = np.stack(
        [np.array(e, dtype=np.float32) for e in face_embeddings]
    )
    centroid = embeddings_array.mean(axis=0)
    centroid /= np.linalg.norm(centroid)
    return json.dumps(centroid.tolist())


def update_person_embedding(session: Session, person_id: int):
    centroid = get_person_embedding(session, person_id, new=True)

    sql = text(
        """
        INSERT OR REPLACE INTO person_embeddings(person_id, embedding)
        VALUES (:p_id, :emb)
    """
    ).bindparams(p_id=person_id, emb=centroid)
    session.exec(sql)
    safe_commit(session)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(a.dot(b) / (na * nb))


def _split_by_scenes(
    media: Media, scenes: Iterable[TimecodePair]
) -> list[tuple[Scene, cv2.typing.MatLike]]:
    scene_objs = []
    for i, (start_time, end_time) in tqdm(
        enumerate(scenes), total=len(scenes)
    ):
        thumb_dir = get_thumb_folder(THUMB_DIR / "scenes")
        thumbnail_path = thumb_dir / f"{i}_{Path(media.path).stem}.jpg"
        ffmpeg.input(
            str(MEDIA_DIR / media.path), ss=start_time.get_seconds()
        ).filter("scale", 480, -1).output(str(thumbnail_path), vframes=1).run(
            quiet=True, overwrite_output=True
        )
        out, _ = (
            ffmpeg.input(
                str(MEDIA_DIR / media.path), ss=start_time.get_seconds()
            )
            .output(
                "pipe:",  # send to stdout
                vframes=1,  # just one frame
                format="image2",  # raw image container
                vcodec="mjpeg",  # JPEG in memory
            )
            .run(capture_stdout=True, quiet=True)
        )
        arr = np.frombuffer(out, np.uint8)
        frame_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        scene = Scene(
            media_id=media.id,
            start_time=start_time,
            end_time=end_time,
            thumbnail_path=str(thumbnail_path.relative_to(thumb_dir)),
        )
        scene_objs.append((scene, frame_rgb))
    return scene_objs


def _split_by_frames(media: Media) -> list[tuple[Scene, cv2.typing.MatLike]]:
    scene_objs = []
    video_path = MEDIA_DIR / media.path
    cap = cv2.VideoCapture(str(video_path))

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    duration = total / fps
    min_frame_step = int(fps * 10)  # Max one screenshot every 20 seconds

    step = max(total // (MAX_FRAMES_PER_VIDEO), min_frame_step)
    frame_indices = list(range(0, total, step))

    for i, idx in enumerate(frame_indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret:
            continue

        # 1) convert to timestamps
        start_sec = idx / fps
        if i + 1 < len(frame_indices):
            end_sec = frame_indices[i + 1] / fps
        else:
            end_sec = duration

        # 2) save a thumbnail
        thumb_name = f"{media.id}_frame_{i}.jpg"
        thumb_dir = get_thumb_folder(THUMB_DIR / "scenes")
        thumb_file = thumb_dir / thumb_name
        (
            ffmpeg.input(str(video_path), ss=start_sec)
            .filter("scale", 360, -1)
            .output(str(thumb_file), vframes=1)
            .run(quiet=True, overwrite_output=True)
        )
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        scene = Scene(
            media_id=media.id,
            start_time=start_sec,
            end_time=end_sec,
            thumbnail_path=str(thumb_file.relative_to(THUMB_DIR)),
        )
        scene_objs.append((scene, frame_rgb))
    cap.release()
    return scene_objs


def _decimal_to_dms(value: float):
    """
    Convert decimal degrees into the EXIF rational format:
    ((deg,1),(min,1),(sec*100,100))
    """
    deg = int(abs(value))
    minutes_full = (abs(value) - deg) * 60
    minute = int(minutes_full)
    sec = round((minutes_full - minute) * 60 * 100)  # two‐decimals
    return ((deg, 1), (minute, 1), (sec, 100))


def update_exif_gps(path: str, lon: float, lat: float):
    image_path = MEDIA_DIR / path
    try:
        exif_dict: dict = piexif.load(image_path)
    except Exception:
        exif_dict: dict = {
            "0th": {},
            "Exif": {},
            "GPS": {},
            "1st": {},
            "thumbnail": None,
        }

    lat_ref = b"N" if lat >= 0 else b"S"
    lng_ref = b"E" if lon >= 0 else b"W"
    lat_dms = _decimal_to_dms(lat)
    lng_dms = _decimal_to_dms(lon)
    gps_ifd = {
        piexif.GPSIFD.GPSLatitudeRef: lat_ref,
        piexif.GPSIFD.GPSLatitude: lat_dms,
        piexif.GPSIFD.GPSLongitudeRef: lng_ref,
        piexif.GPSIFD.GPSLongitude: lng_dms,
    }
    exif_dict["GPS"].update(gps_ifd)
    exif_bytes = piexif.dump(exif_dict)
    img = Image.open(str(image_path))
    img = ImageOps.exif_transpose(img)
    img.save(str(image_path), exif=exif_bytes)


def complete_task(session: Session, task: ProcessingTask):
    task.status = "completed"
    task.finished_at = datetime.now(timezone.utc)
    session.add(task)
    safe_commit(session)


def split_video(
    media: Media, path: Path
) -> list[tuple[Scene, cv2.typing.MatLike]]:
    """Returns select frames from a video and a list of scenes"""
    scenes = detect(
        str(path),
        AdaptiveDetector(
            adaptive_threshold=3, window_width=5, min_scene_len=500
        ),
        show_progress=True,
    )
    logger.error("Detecting scenes...")
    if len(scenes) >= 10:
        return _split_by_scenes(media, scenes)
    else:
        return _split_by_frames(media)


def refresh_similarities_for_person(person_id: int) -> None:
    with Session(engine) as session:
        target = get_person_embedding(session, person_id)
        if target is None:
            return

        # load all other person ids
        other_ids = session.exec(select(Person.id)).all()
        for oid in other_ids:
            if oid == person_id:
                continue
            emb = get_person_embedding(session, oid)
            if emb is None:
                continue
            sim = cosine_similarity(
                np.ndarray(json.loads(target)), np.ndarray(json.loads(emb))
            )
            # upsert into PersonSimilarity
            existing = session.get(PersonSimilarity, (person_id, oid))
            if existing:
                existing.similarity = sim
                existing.calculated_at = datetime.now(timezone.utc)
                session.add(existing)
            else:
                session.add(
                    PersonSimilarity(
                        person_id=person_id, other_id=oid, similarity=sim
                    )
                )
        safe_commit(session)


def delete_record(media_id, session):
    media = session.get(Media, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    thumbnail = media.thumbnail_path
    if not thumbnail:
        thumbnail = str(media.id)
    thumb = Path(THUMB_DIR / thumbnail)
    if thumb.is_file():
        thumb.unlink()
    faces = session.exec(select(Face).where(Face.media_id == media.id)).all()
    for face in faces:
        sql = text(
            """
            DELETE FROM face_embeddings
            WHERE face_id=:f_id
            """
        ).bindparams(f_id=face.id)
        session.exec(sql)
        thumb = Path(THUMB_DIR / face.thumbnail_path)
        if thumb.is_file():
            thumb.unlink()

    sql = text(
        """
        DELETE FROM media_embeddings
        WHERE media_id=:m_id
        """
    ).bindparams(m_id=media.id)
    session.exec(sql)

    session.exec(delete(Face).where(Face.media_id == media_id))
    session.exec(delete(MediaTagLink).where(MediaTagLink.media_id == media_id))
    session.exec(delete(ExifData).where(ExifData.media_id == media_id))
    session.exec(delete(Scene).where(Scene.media_id == media.id))
    session.exec(
        delete(DuplicateMedia).where(DuplicateMedia.media_id == media.id)
    )
    session.delete(media)

    safe_commit(session)


def delete_file(session: Session, media_id: int):
    media = session.get(Media, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    delete_record(media_id, session)

    # delete original file
    orig = MEDIA_DIR / media.path
    if orig.exists():
        orig.unlink()

    # delete thumbnail
    if not media.thumbnail_path:
        thumb = THUMB_DIR / f"{media.id}.jpg"
    else:
        thumb = THUMB_DIR / media.thumbnail_path
    if thumb.exists():
        thumb.unlink()
