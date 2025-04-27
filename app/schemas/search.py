from pydantic import BaseModel

from app.schemas.person import PersonRead
from app.schemas.media import MediaRead
from app.schemas.tag import TagRead


class SearchResult(BaseModel):
    persons: list[PersonRead] | None = None
    media: list[MediaRead] | None = None
    tags: list[TagRead] | None = None
