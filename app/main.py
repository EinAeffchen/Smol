from fastapi import FastAPI, HTTPException, Query
from sqlmodel import select
from app.database import init_db, get_session
from app.models import Media, Person, Face, Tag, MediaTagLink
from app.utils import scan_folder
from app.config import STATIC_DIR, MEDIA_DIR, THUMB_DIR
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.api import media, person, tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the ML model
    init_db()
    scan_folder(MEDIA_DIR)
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(media, prefix="/media", tags=["media"])
app.include_router(person, prefix="/persons", tags=["persons"])
app.include_router(tasks, prefix="/tasks", tags=["tasks"])

app.mount(
    "/thumbnails",
    StaticFiles(directory=str(THUMB_DIR), html=True),
    name="thumbnails",
)
app.mount(
    "/originals",
    StaticFiles(directory=str(MEDIA_DIR), html=True),
    name="originals",
)
app.mount(
    "/",
    StaticFiles(directory=str(STATIC_DIR), html=True),
    name="frontend",
)
