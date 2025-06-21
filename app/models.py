from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column
from sqlalchemy.types import JSON
from datetime import datetime
import uuid
from typing import Optional


class MediaTagLink(SQLModel, table=True):
    media_id: int | None = Field(
        default=None, foreign_key="media.id", primary_key=True
    )
    tag_id: int | None = Field(
        default=None, foreign_key="tag.id", primary_key=True
    )


class PersonTagLink(SQLModel, table=True):
    person_id: int | None = Field(
        default=None, foreign_key="person.id", primary_key=True
    )
    tag_id: int | None = Field(
        default=None, foreign_key="tag.id", primary_key=True
    )


class Tag(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)

    media: list["Media"] = Relationship(
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
    id: int | None = Field(default=None, primary_key=True)
    media_id: int = Field(foreign_key="media.id")
    person_id: int | None = Field(foreign_key="person.id", default=None)
    thumbnail_path: str
    bbox: list[int] = Field(sa_column=Column(JSON))
    embedding: list[float] | None = Field(
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
    id: int | None = Field(default=None, primary_key=True)
    path: str = Field(unique=True)
    filename: str = Field(index=True)
    thumbnail_path: str = Field(default=None)
    size: int
    duration: float | None = None
    width: int | None = None
    height: int | None = None
    views: int = Field(default=0, index=True)
    inserted_at: datetime = Field(default_factory=datetime.now, index=True)
    created_at: datetime = Field(default_factory=datetime.now, index=True)

    faces_extracted: bool = Field(default=False, index=True)
    embeddings_created: bool = Field(default=False, index=True)
    ran_auto_tagging: bool = Field(default=False)
    extracted_scenes: bool = Field(default=False)

    is_favorite: bool = Field(default=False)
    embedding: list[float] | None = Field(
        sa_column=Column(JSON, nullable=True, index=True)
    )
    faces: list["Face"] = Relationship(back_populates="media")
    scenes: list["Scene"] = Relationship(back_populates="media")
    tags: list[Tag] = Relationship(
        back_populates="media", link_model=MediaTagLink
    )
    exif: "ExifData" = Relationship(back_populates="media")

    class Config:
        from_attributes = True

    def __eq__(self, other: "Media"):
        if not isinstance(other, Media):
            return False

        if self.id == other.id:
            return True
        return False


class Scene(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    media_id: int = Field(foreign_key="media.id", index=True)
    start_time: float  # in seconds
    end_time: float  # in seconds
    thumbnail_path: str  # relative path under THUMB_DIR
    description: str | None = Field(default=None)
    embedding: list[float] | None = Field(
        sa_column=Column(JSON, nullable=True, index=True), default=None
    )

    media: "Media" = Relationship(back_populates="scenes")


class Person(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    views: int = Field(default=0, index=True)
    faces: list["Face"] = Relationship(
        back_populates="person",
        sa_relationship_kwargs={
            # same idea: this relationship uses Face.person_id to point back
            "foreign_keys": "[Face.person_id]"
        },
    )
    is_favorite: bool = Field(default=False)
    profile_face_id: int | None = Field(
        foreign_key="face.id", default=None, index=True
    )
    profile_face: Face | None = Relationship(
        sa_relationship_kwargs={
            "primaryjoin": "Person.profile_face_id==Face.id",
            "foreign_keys": "[Person.profile_face_id]",
            "uselist": False,
            "lazy": "selectin",
        }
    )
    tags: list[Tag] = Relationship(
        back_populates="persons", link_model=PersonTagLink
    )
    appearance_count: int = Field(default=None, index=True)

    class Config:
        from_attributes = True


class ProcessingTask(SQLModel, table=True):
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()), primary_key=True
    )
    task_type: str
    status: str = Field(default="pending", index=True)
    total: int = Field(default=0)
    processed: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: datetime | None = None
    finished_at: datetime | None = None

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
    id: int | None = Field(default=None, primary_key=True)
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
