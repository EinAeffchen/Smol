from sqlmodel import SQLModel, Field
from pydantic import BaseModel


class FaceRead(SQLModel):
    id: int
    media_id: int
    thumbnail_path: str
    bbox: list[int]


class FaceAssign(BaseModel):
    person_id: int
