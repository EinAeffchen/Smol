from sqlmodel import SQLModel
from app.models import Media, Person
from app.schemas.person import PersonRead


class TagRead(SQLModel):
    id: int
    name: str
    media: list[Media]
    persons: list[PersonRead]