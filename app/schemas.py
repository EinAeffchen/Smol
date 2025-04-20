from typing import List, Optional
from sqlmodel import SQLModel, Field
from datetime import datetime


class FaceRead(SQLModel):
    id: int
    media_id: int
    thumbnail_path: str
    bbox: List[int]


class PersonRead(SQLModel):
    id: int
    name: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    ethnicity: Optional[str]
    profile_face_id: Optional[int]
    profile_face: Optional[FaceRead]


class MediaRead(SQLModel):
    id: int
    path: str
    filename: str
    size: int
    duration: Optional[float]
    width: Optional[int]
    height: Optional[int]
    views: int
    inserted_at: datetime
    faces: List[FaceRead]
    persons: List[PersonRead] = []  # we'll fill this in manually


class TagRead(SQLModel):
    id: int
    name: str
