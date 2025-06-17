from pydantic import BaseModel

from app.schemas.person import PersonReadSimple
from app.schemas.media import MediaPreview
from app.schemas.tag import TagRead


class SearchResult(BaseModel):
    persons: list[PersonReadSimple] | None = None
    media: list[MediaPreview] | None = None
    tags: list[TagRead] | None = None


class CursorPage(BaseModel):
    items: list[SearchResult]
    next_cursor: str | None
