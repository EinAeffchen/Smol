from sqlmodel import SQLModel
from pydantic import ConfigDict
from app.models import Media
from app.schemas.person import PersonRead


class TagRead(SQLModel):
    id: int
    name: str
    media: list[Media]
    persons: list[PersonRead]


class TagSimple(SQLModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)