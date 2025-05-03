import time

from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from contextlib import contextmanager
from app.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
    # poolclass=StaticPool,
    pool_size=5,
    max_overflow=10,
)


def safe_commit(session, retries=3, delay=0.5):
    for i in range(retries):
        try:
            session.commit()
            return
        except OperationalError as e:
            if "database is locked" in str(e):
                time.sleep(delay)
            else:
                raise
    raise RuntimeError("Failed to commit due to database lock.")


def init_db():
    from app.models import Face, Media, MediaTagLink, Person, Tag, Scene

    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
