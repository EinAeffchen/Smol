import time

from sqlalchemy.exc import OperationalError
from sqlmodel import Session, create_engine
from app.config import settings
from app.logger import logger
from sqlalchemy import event
from sqlalchemy.engine.result import ScalarResult

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
        # Assuming sqlite_vec is imported elsewhere
        import sqlite_vec

        sqlite_vec.load(dbapi_conn)
    finally:
        dbapi_conn.enable_load_extension(False)


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
