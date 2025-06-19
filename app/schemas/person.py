from pydantic import BaseModel, ConfigDict
from app.schemas.face import FaceRead
from sqlmodel import SQLModel


class ProfileFace(BaseModel):
    id: int
    thumbnail_path: str


class PersonDetail(BaseModel):
    id: int
    name: str | None
    profile_face_id: int |None
    profile_face: ProfileFace | None
    tags: list[dict]
    appearance_count: int


class PersonUpdate(BaseModel):
    name: str | None = None
    profile_face_id: int | None = None


class PersonMedia(SQLModel):
    id: int
    path: str
    duration: float | None
    filename: str
    width: int | None
    height: int | None


class PersonMinimal(SQLModel):
    id: int
    name: str | None = None


class PersonRead(SQLModel):
    id: int
    name: str | None
    profile_face: FaceRead | None
    appearance_count: int | None

    model_config = ConfigDict(from_attributes=True)


class PersonReadSimple(SQLModel):
    id: int
    name: str | None
    profile_face: FaceRead | None

    model_config = ConfigDict(from_attributes=True)


class MergePersonsRequest(BaseModel):
    source_id: int
    target_id: int


class SimilarPerson(SQLModel):
    id: int
    name: str | None
    similarity: float
    thumbnail: str | None = None


class CursorPage(BaseModel):
    items: list[PersonRead]
    next_cursor: str | None


class MediaCursorPage(BaseModel):
    items: list[PersonMedia]
    next_cursor: str | None
