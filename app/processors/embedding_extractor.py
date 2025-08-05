import cv2

import torch
from cv2.typing import MatLike
from PIL import Image
from PIL.ImageFile import ImageFile
from sqlmodel import select

from app.models import Media, Scene, Tag
from app.processors.base import MediaProcessor
from app.logger import logger
import numpy as np
from app.config import preprocess, model, settings
from sqlalchemy import text
import json
from tqdm import tqdm
from app.api.media import delete_media_record
from app.utils import safe_commit


class EmbeddingExtractor(MediaProcessor):
    name = "embedding_extractor"
    order = 10

    def load_model(self):
        if settings.processors.image_embedding_processor_active:
            self.active = True

    def unload(self):
        pass

    def _get_embedding(self, media: ImageFile | cv2.typing.MatLike):
        if not isinstance(media, ImageFile):
            media_obj = Image.fromarray(media).convert("RGB")
        else:
            media_obj = media
        try:
            img_tensor = preprocess(media_obj).unsqueeze(0)
        except OSError as e:
            logger.warning("Failed processing because %s", e)
            return False
        with torch.no_grad():
            img_features = model.encode_image(img_tensor)
        img_features /= img_features.norm(dim=-1, keepdim=True)
        return img_features.squeeze(0).tolist()

    def process(
        self,
        media: Media,
        session,
        scenes: list[tuple[Scene, MatLike]] | list[ImageFile] | list[Scene],
    ):
        # 1) skip if already extracted
        if session.exec(
            select(Media).where(
                Media.embeddings_created.is_(True), Media.id == media.id
            )
        ).first():
            return True
        embeddings = list()
        for scene in tqdm(scenes):
            if isinstance(scene, ImageFile):
                embedding = self._get_embedding(scene)
                if not embedding:
                    logger.warning("FAILED ON %s", media.path)
                    delete_media_record(media.id, session)
                    safe_commit(session)
                    return False
                embeddings.append(embedding)
            elif isinstance(scene, tuple):
                embedding = self._get_embedding(scene[1])
                embeddings.append(embedding)
                scene[0].embedding = embedding
                session.add(scene[0])
            else:
                logger.warning("Got instance: %s", type(scene))

        if not media.duration:  # is photo/picture
            media.embedding = embeddings[0]
        else:
            arr = np.stack([np.array(e, dtype=np.float32) for e in embeddings])
            avg = arr.mean(axis=0)
            norm = np.linalg.norm(avg)
            if norm > 0:
                avg /= norm
            media.embedding = avg.tolist()
        media.embeddings_created = True
        session.add(media)
        sql = text(
            """
            INSERT OR REPLACE INTO media_embeddings(media_id, embedding)
            VALUES (:id, :emb)
            """
        ).bindparams(id=media.id, emb=json.dumps(media.embedding))
        session.exec(sql)
        safe_commit(session)
        return True

    def get_results(self, media_id: int, session):
        return session.exec(
            select(Tag).join(Tag.media).where(Media.id == media_id)
        ).first()
