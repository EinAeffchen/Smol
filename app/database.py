import time

from sqlalchemy.exc import OperationalError
from sqlmodel import Session, SQLModel, create_engine
from app.config import DATABASE_URL, SCENE_EMBEDDING_SIZE
from app.logger import logger
from sqlalchemy import event, text
from sqlalchemy.engine.result import ScalarResult

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


def init_db():
    logger.debug("Setting up db!")
    from app.models import Face, Media, MediaTagLink, Person, Tag, Scene

    with engine.connect() as connection:
        # Get the underlying DBAPI connection

        # --- SET PRAGMAS HERE ---
        # These will be set once for the database file.
        logger.debug("Setting database PRAGMAs...")
        # connection.execute(text("PRAGMA journal_mode=WAL;"))
        connection.execute(text("PRAGMA synchronous=NORMAL;"))
        connection.execute(text("PRAGMA busy_timeout = 30000;"))
        logger.debug("PRAGMAs set.")

        # Create all tables
        logger.debug("Creating database tables...")
        SQLModel.metadata.create_all(connection)
        logger.debug("Database tables created.")


def init_vec_index():
    logger.debug("Setting up vector index!")
    with engine.begin() as conn:
        # 1) virtual table over (media_id, embedding)
        conn.execute(
            text(
                f"""
          CREATE VIRTUAL TABLE IF NOT EXISTS media_embeddings
          USING vec0(
            media_id    integer primary key,
            embedding   float[{SCENE_EMBEDDING_SIZE}]
          );
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
          CREATE VIRTUAL TABLE IF NOT EXISTS person_embeddings
          USING vec0(
            person_id   integer,
            embedding   float[512]
          );
        """
            )
        )


def get_session():
    with Session(engine) as session:
        yield session
