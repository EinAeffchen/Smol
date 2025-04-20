import os
from pathlib import Path

MEDIA_DIR = Path(os.getenv("MEDIA_DIR", "./media"))
assert MEDIA_DIR.is_dir()

# Internal storage
SMOL_DIR = MEDIA_DIR / ".smol"
SMOL_DIR.mkdir(parents=True, exist_ok=True)

DB_FILE = SMOL_DIR / "media_platform.db"
DATABASE_URL = f"sqlite:///{str(DB_FILE)}"

THUMB_DIR = SMOL_DIR / "thumbnails"
THUMB_DIR.mkdir(exist_ok=True)

STATIC_DIR: Path = SMOL_DIR / "static"
# Where thumbnails are written
THUMB_DIR = SMOL_DIR / "thumbnails"

VIDEO_SUFFIXES = [
    ".mp4",
    ".mov",
    ".wmv",
    ".avi",
    ".flv",
    ".mkv",
    ".webm",
    ".gp3",
    ".ts",
    ".mpeg",
]
IMAGE_SUFFIXES = [
    ".jpg",
    ".jpeg",
    ".png",
    ".JPG",
    ".tiff",
    ".gif",
    ".bmp",
]
