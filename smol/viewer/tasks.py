# smol/videos/tasks.py
from __future__ import annotations

from pathlib import Path

import cv2
import torch
from celery import shared_task
from django.conf import settings
from facenet_pytorch import MTCNN, InceptionResnetV1
import numpy as np
from viewer.models import Image, Video

from .models import Face, Video

@shared_task
def process_video(video_id: int, start_ts: float | None = None) -> None:
    """
    - Scan one frame every RECOGNITION_FRAME_SKIP
    - Skip anything before `start_ts` (if given)
    - Extract up to RECOGNITION_FACE_COUNT faces
    """
    video = Video.objects.get(pk=video_id)
    cap = cv2.VideoCapture(str(video.full_path))

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_interval = max(1, int(fps * settings.RECOGNITION_FRAME_SKIP))

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    mtcnn = MTCNN(keep_all=True, device=device)
    resnet = InceptionResnetV1(pretrained="vggface2").eval().to(device)

    face_folder = settings.RECOGNITION_DATA_PATH

    faces_buffer: list[Face] = []
    total_faces = 0

    while total_faces < settings.RECOGNITION_FACE_COUNT:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
        if frame_idx % frame_interval != 0:
            continue

        timestamp = frame_idx / fps
        if start_ts is not None and timestamp < start_ts:
            continue

        boxes, _ = mtcnn.detect(frame)
        if boxes is None:
            continue

        # align & embed all detections in one batch
        aligned = mtcnn.extract(frame, boxes, save_path=None)
        with torch.no_grad():
            batch = torch.stack(aligned).to(device)
            embeds = resnet(batch).cpu().numpy()

        for (x1, y1, x2, y2), embed in zip(boxes, embeds):
            if total_faces >= settings.RECOGNITION_FACE_COUNT:
                break

            write_face(
                video_id,
                video,
                face_folder,
                faces_buffer,
                frame,
                timestamp,
                x1,
                y1,
                x2,
                y2,
                embed,
            )
            total_faces += 1

    cap.release()

    if faces_buffer:
        Face.objects.bulk_create(faces_buffer)

    # only mark fully‑auto extraction as done
    if start_ts is None:
        video.extracted_faces = True
        video.save(update_fields=["extracted_faces"])


def write_face(
    video_id: int,
    video: Video,
    face_folder: Path,
    faces_buffer: list,
    frame: cv2.typing.MatLike,
    timestamp: int,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    embed: np.ndarray,
):
    x1, y1, x2, y2 = map(int, (x1, y1, x2, y2))
    crop = frame[y1:y2, x1:x2]
    fname = f"{video_id}_{int(timestamp*1000)}_{x1}_{y1}.jpg"
    face_path: Path = face_folder / str(video_id) / fname
    cv2.imwrite(str(face_path), crop)

    face = Face(
        video=video,
        timestamp=timestamp,
        x=x1,
        y=y1,
        w=x2 - x1,
        h=y2 - y1,
    )
    face.embedding = embed.tobytes()
    face.image.name = face_path.relative_to(settings.STATIC_ROOT)
    faces_buffer.append(face)


@shared_task
def scan_for_new_files() -> None:
    """
    Walk MEDIA_ROOT (and subdirs) looking for files we haven’t yet seen.
    If a path isn’t in Video or Image tables, create it and kick off processing.
    """
    for path in settings.MEDIA_ROOT.rglob("*"):
        # skip non-media extensions if you like
        if path.suffix.lower() in settings.VIDEO_SUFFIXES:
            rel_path = path.relative_to(settings.MEDIA_ROOT)
            if not Video.objects.filter(path=rel_path).exists():
                video = Video.objects.create(
                    path=str(rel_path),
                    filename=path.name,
                    size=path.stat().st_size,
                )
                process_video.delay(video.id)
        # elif path.suffix.lower() in settings.IMAGE_SUFFIXES:
        #     rel_path = path.relative_to(MEDIA_ROOT)
        #     if not Image.objects.filter(path=rel_path).exists():
        #         image = Image.objects.create(
        #             path=str(rel_path),
        #             filename=path.name,
        #             size=path.stat().st_size,
        #         )
        #         process_image.delay(image.id)
