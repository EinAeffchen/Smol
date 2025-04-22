# app/processors/base.py
from abc import ABC, abstractmethod
from sqlmodel import Session
from app.models import Media


class MediaProcessor(ABC):
    """
    A piece of logic that, given a Media row,
    may insert or update other tables to enrich it.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """unique key, e.g. "exif" or "face_extraction" """

    @abstractmethod
    def process(self, media: Media, session: Session) -> None:
        """
        Called once for each new or updated Media.
        Should commit its own changes (e.g. write to its own tables).
        """

    def get_results(self, media_id: int, session: Session):
        """
        Return something JSON‑serializable about this media.
        Default: empty dict.
        Override in subclasses to return meaningful data.
        """
        return {}
