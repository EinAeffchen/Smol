from typing import Literal

from pydantic import BaseModel

from app.schemas.media import MediaPreview


class DuplicateGroup(BaseModel):
    group_id: int
    items: list[MediaPreview]

    class Config:
        from_attributes = True  # If using ORM models


class DuplicatePage(BaseModel):
    items: list[DuplicateGroup]
    next_cursor: int | None


class ResolveDuplicatesRequest(BaseModel):
    group_id: int
    master_media_id: int
    action: Literal["DELETE_FILES", "DELETE_RECORDS", "BLACKLIST_RECORDS"]
