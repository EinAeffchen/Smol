import os
import time
from pathlib import Path
from typing import Dict, List

import cv2
import ffmpeg
from deepface import DeepFace
from PIL import Image
from sqlmodel import select

from app.config import (
    IMAGE_SUFFIXES,
    MEDIA_DIR,
    SMOL_DIR,
    THUMB_DIR,
    VIDEO_SUFFIXES,
)
from app.database import get_session
from app.models import Face, Media


def scan_folder(media_dir: Path = MEDIA_DIR):
    for media_type in VIDEO_SUFFIXES + IMAGE_SUFFIXES:
        for path in media_dir.rglob(f"*{media_type}"):
            if ".smol" in path.parts:
                continue
            process_file(path)


# TODO fix face extraction
# TODO change click on image to open the original
def detect_faces(
    image_path: str,
    detector_backend: str = "mtcnn",
) -> List[Dict]:
    """
    1) Load the image at image_path
    2) Run DeepFace.extract_faces to get [ { "face": np.array, "region": {...} }, ... ]
    3) For each face:
         - write a thumbnail under .smol/thumbnails/<media_id>_<timestamp>_<i>.jpg
         - return its relative path so you can store it in your Face table
    """
    results = []
    # run detection & alignment
    faces = DeepFace.extract_faces(
        img_path=image_path,
        detector_backend=detector_backend,
        enforce_detection=False,
    )
    for idx, face_obj in enumerate(faces):
        face_img = face_obj["face"]  # RGB numpy array
        # filename: use timestamp+idx to avoid collisions
        stem = Path(image_path).stem
        ts = int(time.time() * 1000)
        thumb_name = f"{stem}_{ts}_{idx}.jpg"
        thumb_path = THUMB_DIR / thumb_name

        # save via OpenCV (convert RGB → BGR)
        bgr = cv2.cvtColor(face_img, cv2.COLOR_RGB2BGR)
        cv2.imwrite(str(thumb_path), bgr)

        # you can also store the region if you extend your Face model:
        region = face_obj.get("region", {})

        results.append(
            {
                "thumbnail_path": str(thumb_name),  # store just the file name
                "bbox": [
                    region.get("x"),
                    region.get("y"),
                    region.get("w"),
                    region.get("h"),
                ],
            }
        )

    return results


def process_file(filepath: Path):
    path = filepath.relative_to(MEDIA_DIR)
    session = get_session()
    exists = session.exec(select(Media).where(Media.path == str(path))).first()
    if exists:
        return

    probe = ffmpeg.probe(filepath)
    size = os.path.getsize(filepath)
    print(filepath)
    if filepath.suffix in VIDEO_SUFFIXES:
        duration = float(probe["format"].get("duration", 0))
    else:
        duration = None
    print(duration)
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
    Given a Face row (with .thumbnail_path set), load that thumbnail
    and compute its embedding via DeepFace.represent (Facenet by default).
    Returns a list of floats (the embedding vector).
    """
    # locate the thumbnail we saved earlier
    thumb_file = THUMB_DIR / face.thumbnail_path
    if not thumb_file.exists():
        raise FileNotFoundError(f"Thumbnail missing: {thumb_file}")

    # compute embedding
    reps = DeepFace.represent(
        img_path=str(thumb_file),
        model_name="Facenet",
        detector_backend="mtcnn",
        enforce_detection=False,
        prog_bar=False,
    )
    # DeepFace.represent returns a list of dicts, one per detected face:
    if not reps:
        return []
    embedding = reps[0].get("embedding", [])
    return embedding
