import os
from pathlib import Path
import open_clip

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
MODELS_DIR = Path(__file__).parent / "models"

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
READ_ONLY = os.environ.get("READ_ONLY", "False")
if READ_ONLY.lower() == "true":
    READ_ONLY = True
else:
    READ_ONLY = False

# ------- AI Settings -------------
# Image embedding and text search model
MIN_CLIP_SEARCH_SIMILARITY = 0.1
if READ_ONLY is False:
    model, preprocess, _ = open_clip.create_model_and_transforms(
        "xlm-roberta-large-ViT-H-14", pretrained="frozen_laion5b_s13b_b90k"
    )
else:
    model, preprocess, _ = open_clip.create_model_and_transforms(
        "xlm-roberta-large-ViT-H-14",
        pretrained="frozen_laion5b_s13b_b90k",
        device="cpu",
    )

tokenizer = open_clip.get_tokenizer("xlm-roberta-large-ViT-H-14")
# face recognition settings
MAX_FRAMES_PER_VIDEO = 30
FACE_RECOGNITION_MIN_CONFIDENCE = 0.75
FACE_MATCH_COSINE_THRESHOLD = 0.55
FACE_RECOGNITION_MIN_FACE_PIXELS = 60 * 60
PERSON_MIN_FACE_COUNT = (
    2  # how many matching faces must a person have for auto creation
)
