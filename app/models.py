from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column
from sqlalchemy.types import JSON
from datetime import datetime
import uuid


class MediaTagLink(SQLModel, table=True):
    media_id: Optional[int] = Field(
        default=None, foreign_key="media.id", primary_key=True
    )
    tag_id: Optional[int] = Field(
        default=None, foreign_key="tag.id", primary_key=True
    )


class PersonTagLink(SQLModel, table=True):
    person_id: Optional[int] = Field(
        default=None, foreign_key="person.id", primary_key=True
    )
    tag_id: Optional[int] = Field(
        default=None, foreign_key="tag.id", primary_key=True
    )


class Tag(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)

    media: List["Media"] = Relationship(
        back_populates="tags",
        link_model=MediaTagLink,
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    persons: list["Person"] = Relationship(
        back_populates="tags",
        link_model=PersonTagLink,
        sa_relationship_kwargs={"lazy": "selectin"},
    )

    class Config:
        from_attributes = True


class Face(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    media_id: int = Field(foreign_key="media.id")
    person_id: Optional[int] = Field(foreign_key="person.id")
    thumbnail_path: str
    bbox: List[int] = Field(sa_column=Column(JSON))
    embedding: Optional[List[float]] = Field(
        sa_column=Column(JSON, nullable=True)
    )

    media: "Media" = Relationship(back_populates="faces")
    person: Optional["Person"] = Relationship(
        back_populates="faces",
        sa_relationship_kwargs={"foreign_keys": "[Face.person_id]"},
    )

    class Config:
        from_attributes = True


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

    faces_extracted: bool = Field(default=False, index=True)
    embeddings_created: bool = Field(default=False, index=True)

    faces: List["Face"] = Relationship(back_populates="media")
    tags: List[Tag] = Relationship(
        back_populates="media", link_model=MediaTagLink
    )
    exif: List["ExifData"] = Relationship(back_populates="media")

    class Config:
        from_attributes = True


class Person(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    faces: List["Face"] = Relationship(
        back_populates="person",
        sa_relationship_kwargs={
            # same idea: this relationship uses Face.person_id to point back
            "foreign_keys": "[Face.person_id]"
        },
    )
    profile_face_id: Optional[int] = Field(
        foreign_key="face.id", default=None, index=True
    )
    profile_face: Optional[Face] = Relationship(
        sa_relationship_kwargs={
            "primaryjoin": "Person.profile_face_id==Face.id",
            "foreign_keys": "[Person.profile_face_id]",
            "uselist": False,
            "lazy": "selectin",
        }
    )
    tags: List[Tag] = Relationship(
        back_populates="persons", link_model=PersonTagLink
    )

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


class PersonSimilarity(SQLModel, table=True):
    # composite PK: for person → other person
    person_id: int = Field(foreign_key="person.id", primary_key=True)
    other_id: int = Field(foreign_key="person.id", primary_key=True)
    similarity: float
    calculated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class ExifData(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    media_id: int = Field(foreign_key="media.id", index=True)

    # camera & capture
    make: str | None = Field(default=None, index=True)
    model: str | None = Field(default=None, index=True)
    timestamp: datetime | None = Field(default=None, index=True)

    # lens / exposure
    iso: int | None = Field(default=None, index=True)
    exposure_time: str | None = Field(default=None)
    aperture: str | None = Field(default=None)
    focal_length: float | None = Field(default=None)

    # GPS
    lat: float | None = Field(default=None, index=True)
    lon: float | None = Field(default=None, index=True)

    media: Media = Relationship(back_populates="exif")
