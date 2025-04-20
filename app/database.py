from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import NullPool
from app.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
    poolclass=NullPool,
)


def init_db():
    from app.models import Media, Person, Face, Tag, MediaTagLink

    print("Using DATABASE_URL:", engine.url)
    SQLModel.metadata.create_all(engine)


def get_session():
    return Session(engine)
