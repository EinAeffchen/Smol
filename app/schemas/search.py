from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")


class CursorPage(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None


class SceneSearchResult(BaseModel):
    scene_id: int
    media_id: int
    media_filename: str
    media_thumbnail_path: str | None
    scene_thumbnail_path: str | None
    start_time: float
    end_time: float | None
    distance: float
