from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")


class CursorPage(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None
