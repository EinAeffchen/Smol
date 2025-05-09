import time

from sqlalchemy.exc import OperationalError
from sqlmodel import Session, SQLModel, create_engine
from app.config import DATABASE_URL
from app.logger import logger
from sqlalchemy import event, text
import sqlite_vec

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False, "timeout": 30},
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


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    # enable WAL journal
    dbapi_conn.execute("PRAGMA journal_mode=WAL;")
    # reduce how often SQLite flushes to disk (optional)
    dbapi_conn.execute("PRAGMA synchronous=NORMAL;")
    # ensure we wait up to `timeout` seconds if the DB is locked
    dbapi_conn.execute("PRAGMA busy_timeout = 30000;")  # milliseconds


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
        conn.execute(
            text(
                """
          INSERT OR IGNORE INTO media_embeddings(media_id, embedding)
          SELECT m.id, m.embedding FROM media m LEFT JOIN media_embeddings me ON m.id = me.media_id
            WHERE me.media_id IS NULL
            AND m.embedding IS NOT NULL;
        """
            )
        )
        conn.execute(
            text(
                """
          CREATE VIRTUAL TABLE IF NOT EXISTS face_embeddings
          USING vec0(
            face_id    integer primary key,
            person_id   integer,
            embedding   float[512]
          );
        """
            )
        )
        conn.execute(
            text(
                """
          INSERT OR IGNORE INTO face_embeddings(face_id, person_id, embedding)
          SELECT f.id, COALESCE(f.person_id, -1), f.embedding FROM face f LEFT JOIN face_embeddings fe ON f.id = fe.face_id
            WHERE f.embedding IS NOT NULL
            AND fe.face_id IS NULL;
        """
            )
        )


def get_session():
    with Session(engine) as session:
        yield session
