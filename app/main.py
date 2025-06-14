import logging
import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session

from app.api import face, media, person, search, tags, tasks
from app.api.processors import router as proc_router
from app.config import (
    DATABASE_URL,
    MEDIA_DIR,
    READ_ONLY,
    AUTO_SCAN,
    STATIC_DIR,
    THUMB_DIR,
    AUTO_SCAN_TIMEFRAME
)
from app.database import init_db, init_vec_index
from app.logger import logger
from app.processor_registry import load_processors
from app.api.tasks import _run_scan_and_chain
from sqlalchemy import select
from app.models import ProcessingTask
from app.database import engine

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("uvicorn.error").setLevel(logging.INFO)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)

scheduler = AsyncIOScheduler()


def scheduled_scan_job():
    logger.info("Running scheduled scan and process chain...")
    with Session(engine) as session:
        # Check if any part of the chain is already running
        running_task = session.exec(
            select(ProcessingTask).where(ProcessingTask.status == "running")
        ).first()
        if running_task:
            logger.info(
                "A processing task is already running. Skipping scheduled run."
            )
            return

        # Create the first task in the chain
        task = ProcessingTask(task_type="scan", total=0, processed=0)
        session.add(task)
        session.commit()
        session.refresh(task)

        # Start the chain
        _run_scan_and_chain(task.id)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the ML model
    logging.info("Running in READ_ONLY mode: %s", READ_ONLY)
    if not READ_ONLY:
        init_db()
        init_vec_index()
        load_processors()
    if AUTO_SCAN:
        scheduler.add_job(
            scheduled_scan_job, "interval", minutes=AUTO_SCAN_TIMEFRAME, id="scan_job", misfire_grace_time=60
        )
        scheduler.start()
        logger.info(f"Scheduler started. Scan job scheduled every {AUTO_SCAN_TIMEFRAME} minutes.")
    yield


logger.info("MEDIA_DIR: %s", MEDIA_DIR)
logger.info("DATABASE DIR: %s", DATABASE_URL)

app = FastAPI(lifespan=lifespan)
origins = [os.environ.get("DOMAIN", ""), "http://localhost:5173"]
logger.info("ORIGINS: %s", origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(proc_router, prefix="/api", tags=["processors"])
app.include_router(media, prefix="/api/media", tags=["media"])
app.include_router(person, prefix="/api/persons", tags=["persons"])
app.include_router(tasks, prefix="/api/tasks", tags=["tasks"])
app.include_router(face, prefix="/api/faces", tags=["faces"])
app.include_router(tags, prefix="/api/tags", tags=["tags"])
app.include_router(search, prefix="/api/search", tags=["search"])

app.mount(
    "/thumbnails",
    StaticFiles(directory=str(THUMB_DIR), html=True),
    name="thumbnails",
)
app.mount(
    "/originals",
    StaticFiles(directory=str(MEDIA_DIR)),
    name="originals",
)
app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR), html=True),
    name="static",
)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_catch_all(full_path: str):
    return FileResponse(STATIC_DIR / "index.html")
