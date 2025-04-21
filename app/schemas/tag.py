from sqlmodel import SQLModel
from app.models import Media, Person


class TagRead(SQLModel):
    id: int
    name: str
    media: list[Media]
    persons: list[Person]

    class Config:
        orm_mode = True
