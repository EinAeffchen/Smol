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
STATIC_DIR.mkdir(exist_ok=True, parents=True)
# Where thumbnails are written
THUMB_DIR = SMOL_DIR / "thumbnails"
PLUGINS_DIR = Path(__file__).parent / "plugins"

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

# face recognition settings
VIDEO_SAMPLING_FACTOR = 3
MAX_FRAMES_PER_VIDEO = 30
FACE_RECOGNITION_MIN_CONFIDENCE = 0.75
FACE_MATCH_COSINE_THRESHOLD = 0.7
FACE_RECOGNITION_MIN_FACE_PIXELS = 50 * 50
MINIMUM_SIMILARITY = 0.3
