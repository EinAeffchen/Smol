import json
import os
from collections.abc import Iterable
import subprocess
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Literal

import cv2
import ffmpeg
import imagehash
import numpy as np
import piexif
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from scenedetect import AdaptiveDetector, detect
from scenedetect.video_splitter import TimecodePair
from sqlalchemy import delete, text
from sqlmodel import Session, select
from tqdm import tqdm

from app.config import settings
import app.database as db
from app.database import safe_commit
from app.logger import logger
from app.models import (
    DuplicateMedia,
    ExifData,
    Face,
    Media,
    MediaTagLink,
    Person,
    PersonSimilarity,
    ProcessingTask,
    Scene,
)


def get_image_taken_date(img_path: Path | None = None) -> datetime:
    # fallback use creation time
    alt_time = datetime.fromtimestamp(img_path.stat().st_ctime)

    try:
        img = Image.open(img_path)
    except UnidentifiedImageError:
        return alt_time

    format_code = "%Y:%m:%d %H:%M:%S"
    try:
        exif = img._getexif()
    except AttributeError:
        exif = None
    if exif and (creation_date := exif.get(36867)):
        try:
            return datetime.strptime(creation_date, format_code)
        except ValueError:
            logger.debug(
                "Received invalid time for %s: %s", img_path, creation_date
            )
    return alt_time


def _ffprobe_json(path: Path, timeout: int = 15) -> dict | None:
    """Run ffprobe with a timeout and return parsed JSON, or None on failure.

    Using subprocess directly allows us to enforce a timeout to avoid hangs
    on corrupted or tricky media files.
    """
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        os.fspath(path),
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            logger.warning(
                "ffprobe failed for %s: %s", path, result.stderr.strip()
            )
            return None
        return json.loads(result.stdout or "{}")
    except subprocess.TimeoutExpired:
        logger.error("ffprobe timeout for %s after %ss", path, timeout)
        return None
    except Exception as e:
        logger.error("ffprobe exception for %s: %s", path, e)
        return None


def process_file(filepath: Path) -> Media | None:
    """Reads metadata from the file and prepares a Media record.

    Adds timeouts to external probing to avoid hangs.
    """
    size = os.path.getsize(filepath)
    suffix = filepath.suffix.lower()

    duration: float | None = None
    width: int | None = None
    height: int | None = None

    if suffix in settings.scan.VIDEO_SUFFIXES:
        # Prefer ffprobe with a timeout for videos
        probe = _ffprobe_json(filepath, timeout=15)
        if probe:
            try:
                duration = float(probe.get("format", {}).get("duration", 0))
            except Exception:
                duration = 0.0
            try:
                vs = [
                    s for s in probe.get("streams", []) if s.get("codec_type") == "video"
                ]
                if vs:
                    width = int(vs[0].get("width") or 0) or None
                    height = int(vs[0].get("height") or 0) or None
            except Exception:
                width = width or None
                height = height or None
        else:
            logger.warning("Skipping video probe metadata for %s", filepath)
    else:
        # Images: avoid ffprobe entirely; use PIL for dimensions if possible
        try:
            with Image.open(filepath) as im:
                width, height = im.size
        except UnidentifiedImageError:
            logger.warning("Skipping %s, not an image!", filepath)
        except OSError as e:
            logger.warning("Image %s could not be opened: %s", filepath, e)

    media = Media(
        path=str(filepath),
        filename=filepath.name,
        size=size,
        duration=duration,
        width=width,
        height=height,
        faces_extracted=False,
        embeddings_created=False,
        created_at=get_image_taken_date(img_path=filepath),
        embedding=None,
        phash=None,
    )
    if media.duration is None:
        media.phash = generate_perceptual_hash(media, type="image")
    else:
        media.phash = generate_perceptual_hash(media, type="video")
    return media


def to_posix_str(s: Path) -> str:
    """
    Get a POSIX-style string (forward slashes) regardless of input style.
    """
    if "\\" in str(s) and "/" not in str(s):
        return PureWindowsPath(s).as_posix()
    return PurePosixPath(s).as_posix()


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
        if file_count >= settings.general.thumb_dir_folder_size:
            new_folder = path / str(int(latest.name) + 1)
            new_folder.mkdir(exist_ok=True)
            return new_folder
        return latest


def fix_image_rotation(full_path: Path) -> None:
    if not settings.scan.auto_rotate:
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


def generate_perceptual_hash(
    media: Media, type: Literal["image", "video"]
) -> str | None:
    try:
        if type == "image":
            img = Image.open(media.path)
            return str(imagehash.phash(img))
    except UnidentifiedImageError:
        logger.warning("Skipping %s, not an image!", media.path)
    except OSError:
        logger.warning(
            "Image %s is truncated and can't be processed:", media.path
        )


def generate_thumbnail(media: Media) -> str | None:
    thumb_folder = get_thumb_folder(settings.general.thumb_dir / "media")
    thumb_path = thumb_folder / f"{media.id}.jpg"
    filepath = Path(media.path)
    if filepath.suffix.lower() in settings.scan.VIDEO_SUFFIXES:
        # Use direct subprocess to enforce a timeout; skip on failure
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            "1",
            "-i",
            os.fspath(filepath),
            "-vf",
            "scale=360:-1",
            "-vframes",
            "1",
            "-y",
            os.fspath(thumb_path),
        ]
        try:
            subprocess.run(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=20,
                check=True,
            )
        except subprocess.TimeoutExpired:
            logger.error(
                "ffmpeg timed out generating thumbnail for %s (20s)", filepath
            )
            return None
        except subprocess.CalledProcessError as e:
            logger.error(
                "ffmpeg failed to generate thumbnail for %s: %s", filepath, e
            )
            return None
    else:
        try:
            fix_image_rotation(filepath)
            img = Image.open(filepath)
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
    return to_posix_str(thumb_path.relative_to(settings.general.thumb_dir))


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

    embeddings_array = np.stack([
        np.array(e, dtype=np.float32) for e in face_embeddings
    ])
    centroid = embeddings_array.mean(axis=0)
    centroid /= np.linalg.norm(centroid)
    return json.dumps(centroid.tolist())


def update_person_embedding(session: Session, person_id: int):
    centroid = get_person_embedding(session, person_id, new=True)
    logger.info("Updating person_embedding!")
    del_sql = text(
        """
        DELETE FROM person_embeddings WHERE person_id=:p_id
    """
    ).bindparams(p_id=person_id)
    session.exec(del_sql)
    sql = text(
        """
        INSERT INTO person_embeddings(person_id, embedding)
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
        thumb_dir = get_thumb_folder(settings.general.thumb_dir / "scenes")
        thumbnail_path = thumb_dir / f"{i}_{Path(media.path).stem}.jpg"
        ffmpeg.input(media.path, ss=start_time.get_seconds()).filter(
            "scale", 480, -1
        ).output(str(thumbnail_path), vframes=1).run(
            quiet=True, overwrite_output=True
        )
        out, _ = (
            ffmpeg.input(media.path, ss=start_time.get_seconds())
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
            thumbnail_path=to_posix_str(
                thumbnail_path.relative_to(settings.general.thumb_dir)
            ),
        )
        scene_objs.append((scene, frame_rgb))
    return scene_objs


def _split_by_frames(media: Media) -> list[tuple[Scene, cv2.typing.MatLike]]:
    scene_objs = []
    video_path = media.path
    # Prefer native Windows backend to avoid needing FFmpeg plugin in headless builds.
    cap = (
        cv2.VideoCapture(str(video_path), cv2.CAP_MSMF)
        if os.name == "nt"
        else cv2.VideoCapture(str(video_path))
    )
    if not cap.isOpened():
        # Fallback to default backend selection.
        cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        logger.error("Failed to open video with OpenCV: %s", video_path)
        return []

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    duration = total / fps
    min_frame_step = int(fps * 10)  # Max one screenshot every 20 seconds

    step = max(total // (settings.video.max_frames_per_video), min_frame_step)
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
        thumb_dir = get_thumb_folder(settings.general.thumb_dir / "scenes")
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
            thumbnail_path=to_posix_str(
                thumb_file.relative_to(settings.general.thumb_dir)
            ),
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
    try:
        exif_dict: dict = piexif.load(path)
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
    img = Image.open(str(path))
    img = ImageOps.exif_transpose(img)
    img.save(str(path), exif=exif_bytes)


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
    logger.debug("Detecting scenes...")
    if len(scenes) >= 10:
        return _split_by_scenes(media, scenes)
    else:
        return _split_by_frames(media)


def refresh_similarities_for_person(person_id: int) -> None:
    with Session(db.engine) as session:
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
    thumb = Path(settings.general.thumb_dir / thumbnail)
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
        thumb = Path(settings.general.thumb_dir / face.thumbnail_path)
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
    orig = Path(media.path)
    if orig.exists():
        orig.unlink()

    # delete thumbnail
    if not media.thumbnail_path:
        thumb = settings.general.thumb_dir / f"{media.id}.jpg"
    else:
        thumb = settings.general.thumb_dir / media.thumbnail_path
    if thumb.exists():
        thumb.unlink()
