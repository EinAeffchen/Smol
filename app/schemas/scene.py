from sqlmodel import SQLModel


class SceneRead(SQLModel):
    id: int
    start_time: float
    end_time: float
    thumbnail_path: str
    description: str | None
