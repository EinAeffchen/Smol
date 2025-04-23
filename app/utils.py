import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import cv2
import ffmpeg
import numpy as np
from deepface import DeepFace
from PIL import Image
from sqlmodel import Session, select

from app.config import (
    FACE_RECOGNITION_MIN_CONFIDENCE,
    FACE_RECOGNITION_MIN_FACE_PIXELS,
    MAX_FRAMES_PER_VIDEO,
    MEDIA_DIR,
    MINIMUM_SIMILARITY,
    THUMB_DIR,
    VIDEO_SAMPLING_FACTOR,
    VIDEO_SUFFIXES,
)
from app.database import get_session, safe_commit
from app.models import Face, Media, Person, PersonSimilarity

logger = logging.getLogger(__name__)


def detect_faces(
    media_path: str,
    detector_backend: str = "retinaface",
    enforce_detection: bool = False,
    align: bool = True,
    expand_percentage: int = 0,
) -> list[dict]:
    path = Path(media_path)
    stem = path.stem
    ext = path.suffix.lower()

    def _run_detection(rgb_img, frame_idx):
        out = []
        face_objs = DeepFace.extract_faces(
            img_path=rgb_img,
            detector_backend=detector_backend,
            enforce_detection=enforce_detection,
            align=align,
            expand_percentage=expand_percentage,
        )
        for i, fo in enumerate(face_objs):
            conf = fo.get("confidence", 0.0)
            if conf < FACE_RECOGNITION_MIN_CONFIDENCE:
                continue  # skip low‑confidence

            face_bgr = fo["face"]

            if np.issubdtype(face_bgr.dtype, np.floating):
                face_uint8 = (face_bgr * 255).clip(0, 255).astype("uint8")
            else:
                face_uint8 = face_bgr

            h, w = face_bgr.shape[:2]
            if h * w < FACE_RECOGNITION_MIN_FACE_PIXELS:
                continue  # skip tiny crops

            ts = int(time.time() * 1000)
            name = f"{stem}_{frame_idx}_{i}_{ts}.jpg"
            thumb_file = THUMB_DIR / name
            Image.fromarray(face_uint8).save(thumb_file, format="JPEG")

            fa = fo.get("facial_area", {})
            out.append(
                {
                    "thumbnail_path": name,
                    "bbox": [
                        fa.get("x"),
                        fa.get("y"),
                        fa.get("w"),
                        fa.get("h"),
                    ],
                    "confidence": conf,
                }
            )
        return out

    results = []
    if ext in VIDEO_SUFFIXES:
        cap = cv2.VideoCapture(str(path))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        step = max(total // (MAX_FRAMES_PER_VIDEO * VIDEO_SAMPLING_FACTOR), 1)
        found = 0
        idx = 0
        while found < MAX_FRAMES_PER_VIDEO and idx < total:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                break
            dets = _run_detection(frame, idx)
            if dets:
                results.extend(dets)
                found += 1
            idx += step
        cap.release()
    else:
        img_bgr = cv2.imread(str(path))
        if img_bgr is None:
            raise ValueError(f"Cannot load image {path}")
        # pass raw BGR image to DeepFace
        results = _run_detection(img_bgr, 0)

    return results


def process_file(filepath: Path):
    path = filepath.relative_to(MEDIA_DIR)
    session = get_session()
    exists = session.exec(select(Media).where(Media.path == str(path))).first()
    if exists:
        return

    probe = ffmpeg.probe(filepath)
    size = os.path.getsize(filepath)
    if filepath.suffix in VIDEO_SUFFIXES:
        duration = float(probe["format"].get("duration", 0))
    else:
        duration = None
    vs = [s for s in probe["streams"] if s.get("codec_type") == "video"]
    width = int(vs[0]["width"]) if vs else None
    height = int(vs[0]["height"]) if vs else None

    media = Media(
        path=str(path),
        filename=filepath.name,
        size=size,
        duration=duration,
        width=width,
        height=height,
        faces_extracted=False,
        embeddings_created=False,
    )
    session.add(media)
    safe_commit(session)
    session.refresh(media)

    # generate thumbnails
    thumb_path = THUMB_DIR / f"{media.id}.jpg"
    if path.suffix in VIDEO_SUFFIXES:
        (
            ffmpeg.input(str(filepath), ss=1)
            .filter("scale", 480, -1)
            .output(str(thumb_path), vframes=1)
            .run(quiet=True, overwrite_output=True)
        )
    else:
        img = Image.open(filepath)
        img.thumbnail((480, -1))
        img.save(thumb_path, format="JPEG")


def create_embedding_for_face(face: Face) -> list[float]:
    """
    Load the thumbnail from THUMB_DIR using face.thumbnail_path,
    then call DeepFace.represent() to get a 1×N embedding.
    """
    thumb_file: Path = THUMB_DIR / face.thumbnail_path
    if not thumb_file.exists():
        raise FileNotFoundError(f"Missing thumbnail: {thumb_file}")

    reps = DeepFace.represent(
        img_path=str(thumb_file),
        model_name="Facenet512",
        detector_backend="retinaface",
        enforce_detection=True,
    )
    # reps is List[{"embedding": [...] , ...}], so take the first if present
    if not reps or "embedding" not in reps[0]:
        return []
    return reps[0]["embedding"]


def get_person_embedding(
    session: Session, person_id: int
) -> np.ndarray | None:
    embeddings = session.exec(
        select(Face.embedding).where(
            Face.person_id == person_id, Face.embedding != None
        )
    ).all()
    if not embeddings:
        return None
    arr = np.stack([np.array(e, dtype=np.float32) for e in embeddings])
    return arr.mean(axis=0)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(a.dot(b) / (na * nb))


def refresh_similarities_for_person(person_id: int) -> None:
    with get_session() as session:
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
            sim = cosine_similarity(target, emb)
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
