from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy.types import JSON
from typing import Optional, List
from datetime import datetime
import uuid


class MediaTagLink(SQLModel, table=True):
    media_id: Optional[int] = Field(
        default=None, foreign_key="media.id", primary_key=True
    )
    tag_id: Optional[int] = Field(
        default=None, foreign_key="tag.id", primary_key=True
    )


class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    media: List["Media"] = Relationship(
        back_populates="tags", link_model=MediaTagLink
    )


class Media(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    path: str
    filename: str
    size: int
    duration: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    views: int = 0
    inserted_at: datetime = Field(default_factory=datetime.utcnow)

    # ← New flags:
    faces_extracted: bool = Field(default=False, index=True)
    embeddings_created: bool = Field(default=False, index=True)

    faces: List["Face"] = Relationship(back_populates="media")
    tags: List[Tag] = Relationship(
        back_populates="media", link_model=MediaTagLink
    )


class Person(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    ethnicity: Optional[str]
    faces: List["Face"] = Relationship(back_populates="person")


class Face(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    media_id: int = Field(foreign_key="media.id")
    person_id: Optional[int] = Field(default=None, foreign_key="person.id")
    # ← Make embedding nullable until created
    embedding: Optional[List[float]] = Field(
        sa_column=Column(JSON, nullable=True)
    )
    media: Media = Relationship(back_populates="faces")
    person: Optional[Person] = Relationship(back_populates="faces")
    thumbnail_path: Optional[str] = Field(default=None)
    bbox: Optional[List[int]] = Field(sa_column=Column(JSON), default=None)


class ProcessingTask(SQLModel, table=True):
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()), primary_key=True
    )
    task_type: str  # "extract_faces" or "create_embeddings"
    status: str = Field(default="pending", index=True)
    total: int = Field(default=0)
    processed: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
