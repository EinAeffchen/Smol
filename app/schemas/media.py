from datetime import datetime

from sqlmodel import SQLModel, Field

from app.schemas.face import FaceRead
from app.schemas.person import PersonRead


class MediaRead(SQLModel):
    id: int
    path: str
    filename: str
    size: int
    duration: float | None
    width: int | None
    height: int | None
    views: int
    inserted_at: datetime
    faces: list[FaceRead]
    persons: list[PersonRead] = []  # we'll fill this in manually


class MediaPreview(SQLModel):
    id: int
    filename: str
    duration: float | None
    width: int | None
    height: int | None
    views: int
    inserted_at: datetime


class MediaLocation(SQLModel):
    id: int
    latitude: float
    longitude: float
    thumbnail: str
