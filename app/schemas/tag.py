from sqlmodel import SQLModel
from pydantic import ConfigDict, BaseModel
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


class CursorPage(BaseModel):
    items: list[TagRead]
    next_cursor: str | None
