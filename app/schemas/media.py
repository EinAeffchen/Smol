from datetime import datetime

from sqlmodel import SQLModel, Field
from pydantic import field_validator, ConfigDict, BaseModel

from app.schemas.face import FaceRead
from app.schemas.person import PersonRead
from app.schemas.scene import SceneRead
from app.schemas.tag import TagSimple
from app.models import Face, Person, Media


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
    created_at: datetime
    faces: list[FaceRead]
    persons: list[PersonRead] = []  # we'll fill this in manually
    scenes: list[SceneRead]
    tags: list[TagSimple]
    extracted_scenes: bool

    model_config = ConfigDict(from_attributes=True)


class MediaPreview(SQLModel):
    id: int
    filename: str
    duration: float | None
    width: int | None
    height: int | None
    views: int
    path: str
    inserted_at: datetime


class MediaLocation(SQLModel):
    id: int
    latitude: float
    longitude: float
    thumbnail: str


class FaceWithPerson(SQLModel):
    id: int
    thumbnail_path: str
    person: Person  # your Person model


class MediaDetail(SQLModel):
    media: MediaRead
    persons: list[PersonRead] = Field(default_factory=list)
    faces: list[Face] = Field(default_factory=list)
    orphans: list[Face] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

class MediaNeighbors(SQLModel):
    next_id: int|None
    previous_id: int|None

class GeoUpdate(SQLModel):
    latitude: float
    longitude: float


class CursorPage(BaseModel):
    items: list[MediaPreview]
    next_cursor: str | None
