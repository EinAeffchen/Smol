from sqlmodel import Session
from app.models import Media, Scene
from cv2.typing import MatLike
from PIL.ImageFile import ImageFile
from app.processors.base import MediaProcessor
from sqlmodel import select, text, or_
from app.config import settings, get_model
from app.api.tags import get_or_create_tag, attach_tag_to_media
from app.database import safe_commit
from app.logger import logger
import os
import numpy as np
import torch


class AutoTagger(MediaProcessor):
    """
    A piece of logic that, given a Media row,
    may insert or update other tables to enrich it.
    """

    name = "auto_tagger"
    order = 30

    default_tags = [
        "home",
        "work / office",
        "school / university",
        "outdoors",
        "indoors",
        "city / urban",
        "nature",
        "beach / coast",
        "mountains",
        "forest / woods",
        "park",
        "restaurant / cafe / bar",
        "museum / gallery",
        "airport / station",
        "travel / trip",
        "road trip",
        "birthday",
        "party",
        "wedding",
        "anniversary",
        "graduation",
        "halloween",
        "vacation",
        "concert / live music",
        "festival",
        "sports event",
        "conference",
        "couple",
        "group photo",
        "kids / children",
        "baby",
        "pet",
        "dog",
        "cat",
        "eating / dining",
        "cooking / baking",
        "bbq",
        "sports",
        "hiking / walking",
        "running",
        "cycling",
        "skiing / snowboarding",
        "swimming",
        "shopping",
        "music / playing instrument",
        "art / crafting",
        "gardening",
        "food / drink",
        "architecture / buildings",
        "car / vehicle",
        "flowers / plants",
        "art / design",
        "fashion / outfit",
        "technology / gadgets",
        "spring",
        "summer",
        "autumn / fall",
        "winter",
        "morning",
        "afternoon",
        "evening / night",
        "sunrise / sunset",
        "funny / humorous",
        "candid",
        "posed",
        "sentimental / nostalgic",
        "relaxing / calm",
        "action / dynamic",
        "landscape",
        "portrait",
        "black and white",
        "close-up / macro",
        "panorama",
        "blurry / abstract",
        "scenic",
    ]
    tag_map: dict[str, np.ndarray] = dict()

    def load_model(self):
        self.model, self.preprocessor, self.tokenizer = get_model(settings)
        if settings.tagging.auto_tagging:
            self.active = True

        custom_tags_list = []
        if custom_tags := os.environ.get("CUSTOM_TAGS"):
            custom_tags_list = [tag.strip() for tag in custom_tags.split(",")]
        tags = list(set(self.default_tags + custom_tags_list))
        self.tag_map = {tag: self._tag_to_vector(tag) for tag in tags}

    def unload(self):
        """Used to load models into memory before use"""
        self.tags = []

    def _tag_to_vector(self, tag) -> np.ndarray:
        tokenized_text = self.tokenizer([tag])
        with torch.no_grad():
            # Encode the tokenized text
            text_embedding = self.model.encode_text(tokenized_text)
            # Normalize the embedding to a unit vector
            text_embedding /= text_embedding.norm(dim=-1, keepdim=True)
        # Return as a NumPy array
        return text_embedding.squeeze(0).cpu().numpy()

    def process(
        self,
        media: Media,
        session: Session,
        scenes: list[tuple[Scene, MatLike]] | list[ImageFile] | list[Scene],
    ) -> bool|None:
        if session.exec(
            select(Media).where(
                or_(
                    Media.ran_auto_tagging.is_(True),
                    Media.embeddings_created.is_(False),
                ),
                Media.id == media.id,
            )
        ).first():
            return True

        sql = text(
            """
            SELECT embedding
                FROM media_embeddings
                WHERE media_id=:m_id
            """
        ).bindparams(
            m_id=media.id,
        )
        raw_media_embedding_bytes = session.exec(sql).first()
        if not raw_media_embedding_bytes:
            logger.warning(
                "No embedding found for %s, can't apply auto tagging",
                media.path,
            )
            return
        
        media_embedding = np.frombuffer(raw_media_embedding_bytes[0], dtype=np.float32)
        for tag, tag_vector in self.tag_map.items():
            similarity_score = np.dot(media_embedding, tag_vector)
            if similarity_score > 0.2:
                tag_obj = get_or_create_tag(tag, session)
                attach_tag_to_media(
                    media.id, tag_obj.id, session, score=similarity_score
                )
        media.ran_auto_tagging = True
        safe_commit(session)
        return True

    def get_results(self, media_id: int, session: Session):
        """
        Return something JSON‑serializable about this media.
        Default: empty dict.
        Override in subclasses to return meaningful data.
        """
        return session.exec(
            select(Media.tags).where(Media.id == media_id)
        ).all()
