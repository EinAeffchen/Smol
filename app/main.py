import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import media, person, tasks, face, tags, search
from app.config import MEDIA_DIR, STATIC_DIR, THUMB_DIR
from app.database import init_db, init_vec_index
from app.api.processors import router as proc_router
from app.processor_registry import load_processors
from fastapi.middleware.cors import CORSMiddleware

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
    init_vec_index()
    load_processors()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(proc_router, prefix="/api", tags=["processors"])
app.include_router(media, prefix="/media", tags=["media"])
app.include_router(person, prefix="/persons", tags=["persons"])
app.include_router(tasks, prefix="/tasks", tags=["tasks"])
app.include_router(face, prefix="/faces", tags=["faces"])
app.include_router(tags, prefix="/tags", tags=["tags"])
app.include_router(search, prefix="/search", tags=["search"])

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
    StaticFiles(directory=str(STATIC_DIR)),
    name="static",
)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_catch_all(full_path: str):
    return FileResponse(STATIC_DIR / "index.html")
