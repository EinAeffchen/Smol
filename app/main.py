import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import media, person, tasks, face, tags
from app.config import MEDIA_DIR, STATIC_DIR, THUMB_DIR
from app.database import init_db
from app.utils import scan_folder

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("uvicorn.error").setLevel(logging.INFO)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)


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
app.include_router(face, prefix="/faces", tags=["faces"])
app.include_router(tags, prefix="/tags", tags=["tags"])

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
    "/static",
    StaticFiles(directory=str(STATIC_DIR)),
    name="static",
)


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_catch_all(full_path: str):
    return FileResponse(STATIC_DIR / "index.html")
