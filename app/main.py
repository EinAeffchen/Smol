import logging
import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session
from datetime import datetime, timedelta
import mimetypes

from app.api import face, media, person, search, tags, tasks, duplicates
from app.api.processors import router as proc_router
from app.config import (
    DATABASE_URL,
    MEDIA_DIR,
    READ_ONLY,
    AUTO_SCAN,
    STATIC_DIR,
    THUMB_DIR,
    AUTO_SCAN_TIMEFRAME,
)
from app.database import init_db, init_vec_index
from app.logger import logger
from app.processor_registry import load_processors
from app.api.tasks import _run_cleanup_and_chain
from sqlalchemy import select, or_, and_
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
    logger.info("Running scheduled cleanup and process chain...")
    with Session(engine) as session:
        # Check if any part of the chain is already running
        running_task = session.exec(
            select(ProcessingTask).where(
                and_(
                    or_(
                        ProcessingTask.status == "running",
                        ProcessingTask.status == "pending",
                    ),
                    ProcessingTask.created_at > datetime.now()-timedelta(hours=6)
                )
            )       
        ).first()
        if running_task:
            logger.info(
                "A processing task is already running. Skipping scheduled run."
            )
            return

        # Create the first task in the chain
        task = ProcessingTask(task_type="clean_missing_files", total=0, processed=0)
        session.add(task)
        session.commit()
        session.refresh(task)

        # Start the chain
        _run_cleanup_and_chain(task.id)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the ML model
    logging.info("Running in READ_ONLY mode: %s", READ_ONLY)
    load_processors()
    if not READ_ONLY:
        init_db()
        init_vec_index()
    if AUTO_SCAN:
        scheduler.add_job(
            scheduled_scan_job,
            "interval",
            minutes=AUTO_SCAN_TIMEFRAME,
            id="scan_job",
            misfire_grace_time=60,
        )
        scheduler.start()
        logger.info(
            f"Scheduler started. Scan job scheduled every {AUTO_SCAN_TIMEFRAME} minutes."
        )
    yield


logger.info("MEDIA_DIR: %s", MEDIA_DIR)
logger.info("DATABASE DIR: %s", DATABASE_URL)

app = FastAPI(lifespan=lifespan, redoc_url=None)
origins = [os.environ.get("DOMAIN", ""), "http://localhost:5173"]
logger.info("ORIGINS: %s", origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_accept_ranges_header(request: Request, call_next):
    # First, get the response from the actual endpoint (e.g., StaticFiles)
    response = await call_next(request)

    # Check if the request path was for the /originals mount point
    if request.url.path.startswith("/originals"):
        # If so, add the header to the response
        response.headers["Accept-Ranges"] = "bytes"

    return response


app.include_router(proc_router, prefix="/api", tags=["processors"])
app.include_router(media, prefix="/api/media", tags=["media"])
app.include_router(person, prefix="/api/person", tags=["person"])
app.include_router(tasks, prefix="/api/tasks", tags=["tasks"])
app.include_router(face, prefix="/api/faces", tags=["faces"])
app.include_router(tags, prefix="/api/tags", tags=["tags"])
app.include_router(search, prefix="/api/search", tags=["search"])
app.include_router(duplicates, prefix="/api/duplicates", tags=["duplicates"])

app.mount(
    "/thumbnails",
    StaticFiles(directory=str(THUMB_DIR), html=True),
    name="thumbnails",
)


@app.get("/originals/{file_path:path}", include_in_schema=False)
async def serve_original_media(file_path: str):
    full_path = MEDIA_DIR.joinpath(file_path)

    # Security check to prevent accessing files outside the MEDIA_DIR
    if not full_path.is_file() or not str(full_path).startswith(
        str(MEDIA_DIR)
    ):
        raise HTTPException(status_code=404, detail="File not found")

    # Guess the MIME type from the file extension
    mime_type, _ = mimetypes.guess_type(full_path)
    if mime_type is None:
        # Fallback if MIME type can't be guessed
        mime_type = "application/octet-stream"

    # Create a FileResponse, which handles byte-range requests correctly
    response = FileResponse(full_path, media_type=mime_type)

    # Manually add the header that Firefox requires
    response.headers["Accept-Ranges"] = "bytes"

    return response


app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR), html=True),
    name="static",
)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_catch_all(full_path: str):
    return FileResponse(
        STATIC_DIR / "index.html",
        headers={"Cache-Control": "no-cache, max-age=0, must-revalidate"},
    )
