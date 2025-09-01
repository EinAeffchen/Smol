import os
import sys
import time
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.engine.result import ScalarResult
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, create_engine

from app.config import settings
from app.logger import logger

engine = create_engine(
    settings.general.database_url,
    echo=False,
    connect_args={"check_same_thread": False, "timeout": 30},
    pool_size=5,
    max_overflow=10,
)


@event.listens_for(engine, "connect")
def _load_sqlite_extensions(dbapi_conn, connection_record):
    # 1) allow loading
    dbapi_conn.enable_load_extension(True)
    try:
        # Prefer explicit path via env or bundled location
        vec_name = {
            "win32": "vec0.dll",
            "cygwin": "vec0.dll",
            "darwin": "vec0.dylib",
        }.get(sys.platform, "vec0.so")

        # If running as a bundled app, provide a sensible default path
        if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
            os.environ.setdefault("SQLITE_VEC_PATH", str(Path(sys._MEIPASS) / vec_name))

        vec_path = os.environ.get("SQLITE_VEC_PATH")
        if vec_path and Path(vec_path).exists():
            dbapi_conn.load_extension(vec_path)
        else:
            # Fallback: let sqlite_vec resolve its own packaged library
            try:
                import sqlite_vec

                sqlite_vec.load(dbapi_conn)
            except Exception as e:
                # Re-raise with clearer context
                raise RuntimeError(f"Failed to load sqlite-vec extension: {e}")
    finally:
        dbapi_conn.enable_load_extension(False)


def ensure_vec_tables():
    """Ensure vec0 virtual tables exist (idempotent)."""
    # Try best to ensure the sqlite-vec extension can be located in binary mode
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        # Provide default path to bundled vec0 binary if not set
        vec_name = {
            "win32": "vec0.dll",
            "cygwin": "vec0.dll",
            "darwin": "vec0.dylib",
        }.get(sys.platform, "vec0.so")
        os.environ.setdefault(
            "SQLITE_VEC_PATH", str(Path(sys._MEIPASS) / vec_name)
        )

    dim_media = settings.ai.clip_model_embedding_size
    with engine.begin() as conn:
        conn.exec_driver_sql(
            f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS media_embeddings
            USING vec0(
                media_id  integer primary key,
                embedding float[{dim_media}]
            );
            """
        )
        conn.exec_driver_sql(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS face_embeddings
            USING vec0(
                face_id   integer primary key,
                person_id integer,
                embedding float[128]
            );
            """
        )
        conn.exec_driver_sql(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS person_embeddings
            USING vec0(
                person_id integer,
                embedding float[128]
            );
            """
        )


def safe_commit(session, retries=5, delay=0.5):
    for i in range(retries):
        try:
            session.commit()
            return
        except OperationalError as e:
            logger.error("OPERATION ERROR: %s", str(e))
            if "locked" in str(e):
                session.rollback()
                if i < retries - 1:
                    time.sleep(delay * (2**i))
                    continue
            session.rollback()
            raise
    raise RuntimeError("Failed to commit due to database lock.")


def safe_execute(
    session: Session, query, retries=5, delay=0.5
) -> ScalarResult:
    for i in range(retries):
        try:
            return session.exec(query)
        except OperationalError as e:
            if "locked" in str(e):
                session.rollback()
                if i < retries - 1:
                    time.sleep(delay * (2**i))
                    continue
            session.rollback()
            raise
    raise RuntimeError("Failed to commit due to database lock.")


def get_session():
    with Session(engine) as session:
        yield session
