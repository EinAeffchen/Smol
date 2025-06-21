# app/processors/exif.py
import json
import time
from pathlib import Path

import numpy as np
from cv2.typing import MatLike
from insightface.app import FaceAnalysis
from PIL import Image
from PIL.ImageFile import ImageFile
from sqlmodel import select, text
from tqdm import tqdm

from app.api.media import delete_media_record
from app.config import FACE_RECOGNITION_MIN_FACE_PIXELS, THUMB_DIR
from app.database import safe_commit
from app.logger import logger
from app.models import ExifData, Face, Media, Scene
from app.processors.base import MediaProcessor
from app.utils import get_thumb_folder


class FaceProcessor(MediaProcessor):
    name = "faces"

    def _crop_with_margin(
        self, img: np.ndarray, bbox: list[int], pad_pct: float = 0.2
    ):
        """
        img: HxWx3 BGR or RGB array
        bbox: [x, y, w, h]
        pad_pct: fraction of width/height to pad on each side
        """
        h_img, w_img = img.shape[:2]
        x, y, w, h = bbox

        # compute pad in pixels
        pad_x = int(w * pad_pct)
        pad_y = int(h * pad_pct)

        # apply, but clamp to image edges
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(w_img, x + w + pad_x)
        y2 = min(h_img, y + h + pad_y)

        return img[y1:y2, x1:x2]

    def _parse_faces(
        self, faces: list, scene: MatLike, media: Media
    ) -> list[Face]:
        face_objs = []
        for i, f in enumerate(faces):
            x1, y1, x2, y2 = map(int, f.bbox)
            crop = self._crop_with_margin(
                scene, [x1, y1, x2 - x1, y2 - y1], pad_pct=0.2
            )
            h, w = crop.shape[:2]
            if h * w < FACE_RECOGNITION_MIN_FACE_PIXELS:
                continue

            ts = int(time.time() * 1000)
            name = f"{Path(media.path).stem}_ins_{i}_{ts}.jpg"
            thumb_dir = get_thumb_folder(THUMB_DIR / "faces")
            thumb_file = thumb_dir / name
            pil_img = Image.fromarray(crop)
            pil_img.thumbnail((320, -1), Image.LANCZOS)
            pil_img.save(
                thumb_file,
                format="JPEG",
                quality=85,
                optimize=True,
                progressive=True,
            )
            vec = np.array(f.embedding, dtype=np.float32)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec /= norm
            face = Face(
                media=media,
                thumbnail_path=str(thumb_file.relative_to(THUMB_DIR)),
                bbox=[x1, y1, x2 - x1, y2 - y1],
                embedding=vec.tolist(),
            )
            face_objs.append(face)
        return face_objs

    def process(
        self,
        media: Media,
        session,
        scenes: list[tuple[Scene, MatLike]] | list[ImageFile] | list[Scene],
    ):
        # 1) skip if already extracted
        if session.exec(
            select(Media).where(
                Media.id == media.id,
                Media.faces_extracted.is_(True),
                Media.embeddings_created.is_(True),
            )
        ).first():
            return
        for scene in tqdm(scenes):
            try:
                if isinstance(scene, tuple):
                    scene = scene[1]
                elif isinstance(scene, Scene):
                    scene = Image.open(THUMB_DIR / scene.thumbnail_path)
                    scene = np.array(scene.convert("RGB"))
                else:
                    scene = np.array(scene.convert("RGB"))
            except OSError:
                logger.warning("FAILED ON %s", media.path)
                delete_media_record(media.id, session)
                return False

            faces = self.model.get(scene)
            face_objs = self._parse_faces(faces, scene, media)

            if not face_objs:
                continue

            session.add_all(face_objs)
            session.flush()

            for face_obj in face_objs:
                sql = text(
                    """
                        INSERT OR REPLACE INTO face_embeddings(face_id, person_id, embedding)
                        VALUES (:id, -1, :emb)
                        """
                ).bindparams(
                    id=face_obj.id, emb=json.dumps(face_obj.embedding)
                )
                session.exec(sql)
        media.faces_extracted = True
        media.embeddings_created = True
        session.add(media)
        safe_commit(session)
        return True

    def load_model(self):
        self.model = FaceAnalysis(
            "buffalo_l",
            providers=["CPUExecutionProvider"],
        )
        self.model.prepare(ctx_id=0)  # ctx_id=0 for GPU, -1 for CPU

    def unload(self):
        if self.model:
            del self.model

    def get_results(self, media_id: int, session):
        return session.exec(
            select(ExifData).where(ExifData.media_id == media_id)
        ).first()
