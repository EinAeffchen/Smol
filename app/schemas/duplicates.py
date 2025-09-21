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


class DuplicateTypeSummary(BaseModel):
    type: Literal["image", "video"]
    items: int
    groups: int
    size_bytes: int


class DuplicateFolderStat(BaseModel):
    folder: str
    items: int
    groups: int
    size_bytes: int


class DuplicateStats(BaseModel):
    total_groups: int
    total_items: int
    total_size_bytes: int
    total_reclaimable_bytes: int
    type_breakdown: list[DuplicateTypeSummary]
    top_folders: list[DuplicateFolderStat]


class ResolveDuplicatesRequest(BaseModel):
    group_id: int
    master_media_id: int
    action: Literal["DELETE_FILES", "DELETE_RECORDS", "BLACKLIST_RECORDS"]
