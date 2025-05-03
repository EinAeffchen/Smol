from pydantic import BaseModel

from app.schemas.person import PersonRead
from app.schemas.media import MediaPreview
from app.schemas.tag import TagRead


class SearchResult(BaseModel):
    persons: list[PersonRead] | None = None
    media: list[MediaPreview] | None = None
    tags: list[TagRead] | None = None
