import json
import logging
import mimetypes
import os
import sys
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

os.environ["QT_API"] = "pyside6"
import uvicorn
import webview
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import and_, or_, select
from sqlmodel import Session

from alembic import command
from alembic.config import Config
from app.api import (
    config,
    duplicates,
    face,
    media,
    person,
    search,
    tags,
    tasks,
)
from app.api.processors import router as proc_router
from app.api.tasks import _run_cleanup_and_chain
from app.config import settings
from app.database import engine, ensure_vec_tables
from app.logger import logger
from app.models import ProcessingTask
from app.processor_registry import load_processors

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
                    ProcessingTask.created_at
                    > datetime.now() - timedelta(hours=6),
                )
            )
        ).first()
        if running_task:
            logger.info(
                "A processing task is already running. Skipping scheduled run."
            )
            return

        # Create the first task in the chain
        task = ProcessingTask(
            task_type="clean_missing_files", total=0, processed=0
        )
        session.add(task)
        session.commit()
        session.refresh(task)

        # Start the chain
        _run_cleanup_and_chain(task.id)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the ML model
    load_processors()
    # Ensure vec0 tables exist even if Alembic couldn't create them (binary mode).
    try:
        ensure_vec_tables()
    except Exception as e:
        logger.warning("Could not ensure vec0 tables: %s", e)
    if settings.scan.auto_scan:
        scheduler.add_job(
            scheduled_scan_job,
            "interval",
            minutes=settings.scan.scan_interval_minutes,
            id="scan_job",
            misfire_grace_time=60,
        )
        scheduler.start()
        logger.info(
            f"Scheduler started. Scan job scheduled every {settings.scan.scan_interval_minutes} minutes."
        )
    yield


logger.debug(settings)

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


# @app.middleware("http")
# async def add_accept_ranges_header(request: Request, call_next):
#     # First, get the response from the actual endpoint (e.g., StaticFiles)
#     response = await call_next(request)

#     # Check if the request path was for the /originals mount point
#     if request.url.path.startswith("/originals"):
#         # If so, add the header to the response
#         response.headers["Accept-Ranges"] = "bytes"

#     return response


app.include_router(proc_router, prefix="/api", tags=["processors"])
app.include_router(media, prefix="/api/media", tags=["media"])
app.include_router(person, prefix="/api/person", tags=["person"])
app.include_router(tasks, prefix="/api/tasks", tags=["tasks"])
app.include_router(face, prefix="/api/faces", tags=["faces"])
app.include_router(tags, prefix="/api/tags", tags=["tags"])
app.include_router(search, prefix="/api/search", tags=["search"])
app.include_router(duplicates, prefix="/api/duplicates", tags=["duplicates"])
app.include_router(config, prefix="/api/config", tags=["config"])

app.mount(
    "/thumbnails",
    StaticFiles(directory=str(settings.general.thumb_dir), html=True),
    name="thumbnails",
)


@app.get("/originals/{file_path:path}", include_in_schema=False)
async def serve_original_media(file_path: str):
    file_path_obj = Path(file_path)

    # Security check to prevent accessing files outside the settings.general.media_dirs
    if not file_path_obj.is_file() or not any(
        str(file_path_obj).startswith(str(media_dir))
        for media_dir in settings.general.media_dirs
    ):
        raise HTTPException(status_code=404, detail="File not found")

    # Guess the MIME type from the file extension
    mime_type, _ = mimetypes.guess_type(file_path_obj)
    if mime_type is None:
        # Fallback if MIME type can't be guessed
        mime_type = "application/octet-stream"

    # Create a FileResponse, which handles byte-range requests correctly
    response = FileResponse(file_path_obj, media_type=mime_type)

    # Manually add the header that Firefox requires
    response.headers["Accept-Ranges"] = "bytes"

    return response


app.mount(
    "/static",
    StaticFiles(directory=str(settings.general.static_dir), html=True),
    name="static",
)
# app.mount(
#     "/media",
#     StaticFiles(directory=settings.general.media_dirs),
#     name="media",
# )


def resolve_path(path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        # Running in a PyInstaller bundle
        base_path = Path(sys._MEIPASS)
    else:
        # Running in a normal Python environment
        base_path = Path(".")

    return base_path / path


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_catch_all(full_path: str):
    index_html_path = settings.general.static_dir / "index.html"

    try:
        # 1. Read the static index.html file content
        with open(index_html_path, "r") as f:
            html_content = f.read()
    except FileNotFoundError:
        return Response(content="Frontend not found", status_code=404)
    config = {
        "VITE_API_READ_ONLY": os.environ.get("READ_ONLY", "false"),
        "VITE_API_ENABLE_PEOPLE": os.environ.get("ENABLE_PEOPLE", "true"),
    }
    config_script = (
        f"<script>window.runtimeConfig = {json.dumps(config)};</script>"
    )
    modified_html = html_content.replace(
        "</head>", f"{config_script}</head>", 1
    )

    return HTMLResponse(
        content=modified_html,
        headers={"Cache-Control": "no-cache, max-age=0, must-revalidate"},
    )


def run_server():
    """Runs the Uvicorn server."""
    global server
    config = uvicorn.Config(app, host="127.0.0.1", port=8123)
    server = uvicorn.Server(config)
    server.run()


def shutdown():
    """Signals the Uvicorn server to shut down."""
    if server:
        print("Shutting down Uvicorn server...")
        server.should_exit = True
        # Give the server a moment to close its connections
        time.sleep(1)


def run_migrations():
    """Runs Alembic migrations programmatically."""
    print("Running database migrations...")
    try:
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        print("Migrations applied successfully.")
    except Exception as e:
        print(f"Error applying migrations: {e}")
        raise


def start_server():
    """Starts the Uvicorn server in a daemon thread."""
    uvicorn.run(app, host="127.0.0.1", port=8123)


if __name__ == "__main__":
    # 1. Run database migrations before starting the app
    # Ensure SQLITE_VEC_PATH is set to the correct bundled library name
    try:
        if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
            if sys.platform in ("win32", "cygwin"):
                vec_name = "vec0.dll"
            elif sys.platform == "darwin":
                vec_name = "vec0.dylib"
            else:
                vec_name = "vec0.so"
            vec_path = os.path.join(sys._MEIPASS, vec_name)
            os.environ["SQLITE_VEC_PATH"] = vec_path
    except Exception:
        # Non-fatal: alembic/env.py and database hooks will also attempt to set this
        pass
    run_migrations()
    # 2. Start the Uvicorn server in a separate thread
    # server_thread = threading.Thread(target=start_server)
    # server_thread.daemon = (
    #    True  # This allows the main thread to exit and kill the server
    # )
    # server_thread.start()
    base_path = sys._MEIPASS
    print(f"Base path (_MEIPASS): {base_path}")
    # 3. Create and start the pywebview window
    # This is a blocking call and will run until the window is closed
    server_thread = threading.Thread(target=run_server)
    server_thread.start()

    # Create the pywebview window
    window = webview.create_window(
        "Smol",
        "http://127.0.0.1:8123",  # Point to the URL
        width=1280,
        height=720,
    )

    # Register the shutdown function to be called when the window is closed
    window.events.closed += shutdown

    webview.start(debug=True, gui="qt")

    # Wait for the server thread to finish before exiting the script
    print("Waiting for server thread to close...")
    server_thread.join()
    print("Application shut down cleanly.")
