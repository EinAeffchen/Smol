from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool
from app.config import DATABASE_URL
from sqlalchemy.exc import OperationalError
import time

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
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
    from app.models import Media, Person, Face, Tag, MediaTagLink

    print("Using DATABASE_URL:", engine.url)
    SQLModel.metadata.create_all(engine)


def get_session():
    return Session(engine)
