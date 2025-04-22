from pydantic import BaseModel
from app.schemas.face import FaceRead
from sqlmodel import SQLModel


class PersonDetail(BaseModel):
    person: dict  # or import dict[str, Any] if you want a strict shape
    medias: list[dict]  # list of Media dicts
    faces: list[dict]


class PersonUpdate(BaseModel):
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    ethnicity: str | None = None
    profile_face_id: int | None = None


class PersonRead(SQLModel):
    id: int
    name: str | None
    age: int | None
    gender: str | None
    ethnicity: str | None
    profile_face_id: int | None
    profile_face: FaceRead | None

    class Config:
        orm_mode = True

class MergePersonsRequest(BaseModel):
    source_id: int
    target_id: int
