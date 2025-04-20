import os
import time
from pathlib import Path
from typing import Dict, List

import cv2
import ffmpeg
from deepface import DeepFace
from PIL import Image
from sqlmodel import select, delete
import numpy as np
from app.config import (
    IMAGE_SUFFIXES,
    MEDIA_DIR,
    SMOL_DIR,
    THUMB_DIR,
    VIDEO_SUFFIXES,
    MAX_FRAMES_PER_VIDEO,
    VIDEO_SAMPLING_FACTOR,
    FACE_RECOGNITION_MIN_CONFIDENCE,
    FACE_RECOGNITION_MIN_FACE_PIXELS,
)
from app.database import get_session
from app.models import Face, Media
import logging

logger = logging.getLogger(__name__)


def scan_folder(media_dir: Path = MEDIA_DIR):
    for media_type in VIDEO_SUFFIXES + IMAGE_SUFFIXES:
        for path in media_dir.rglob(f"*{media_type}"):
            if ".smol" in path.parts:
                continue
            process_file(path)


def detect_faces(
    media_path: str,
    detector_backend: str = "retinaface",
    enforce_detection: bool = False,
    align: bool = True,
    expand_percentage: int = 0,
) -> List[Dict]:
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
    session.commit()
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


def create_embedding_for_face(face: Face) -> List[float]:
    """
    Load the thumbnail from THUMB_DIR using face.thumbnail_path,
    then call DeepFace.represent() to get a 1×N embedding.
    """
    thumb_file: Path = THUMB_DIR / face.thumbnail_path
    if not thumb_file.exists():
        raise FileNotFoundError(f"Missing thumbnail: {thumb_file}")

    reps = DeepFace.represent(
        img_path=str(thumb_file),
        model_name="Facenet",
        detector_backend="retinaface",
        enforce_detection=True,
    )
    # reps is List[{"embedding": [...] , ...}], so take the first if present
    if not reps or "embedding" not in reps[0]:
        return []
    return reps[0]["embedding"]
