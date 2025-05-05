import time

from sqlalchemy.exc import OperationalError
from sqlmodel import Session, SQLModel, create_engine
from app.config import DATABASE_URL
from app.logger import logger
from sqlalchemy import event, text
import sqlite_vec

logger.debug("Database loaded from %s", DATABASE_URL)
engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
    pool_size=5,
    max_overflow=10,
)


@event.listens_for(engine, "connect")
def _load_sqlite_extensions(dbapi_conn, connection_record):
    # 1) allow loading
    dbapi_conn.enable_load_extension(True)
    # 2) let sqlite_vec find & load the right library for us
    sqlite_vec.load(dbapi_conn)
    # 3) lock it back down
    dbapi_conn.enable_load_extension(False)


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


def init_vec_index():
    with engine.begin() as conn:
        # 1) virtual table over (media_id, embedding)
        conn.execute(
            text(
                """
          CREATE VIRTUAL TABLE IF NOT EXISTS media_embeddings
          USING vec0(
            media_id    integer primary key,
            embedding   float[1024]
          );
        """
            )
        )
        conn.execute(text("DELETE FROM media_embeddings;"))
        # 2) populate it from your media table
        conn.execute(
            text(
                """
          INSERT OR REPLACE INTO media_embeddings(media_id, embedding)
          SELECT id, embedding FROM media WHERE embedding IS NOT NULL;
        """
            )
        )


def get_session():
    with Session(engine) as session:
        yield session
