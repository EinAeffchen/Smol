import os
from pathlib import Path
import open_clip
from app.logger import logger

MEDIA_DIR = Path(os.getenv("MEDIA_DIR", "/app/media"))
DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))

DATABASE_DIR = DATA_DIR / "database"
if not MEDIA_DIR.is_dir():
    raise Exception("MEDIA_DIR: %s is not a directory!", MEDIA_DIR)

DATABASE_DIR.mkdir(parents=False, exist_ok=True)

# Internal storage
SMOL_DIR = DATA_DIR / ".smol"
SMOL_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DATABASE_DIR}/smol.db?cache=shared&mode=rwc&_journal_mode=WAL&_synchronous=NORMAL"

THUMB_DIR = SMOL_DIR / "thumbnails"
THUMB_DIR.mkdir(exist_ok=True)
THUMB_DIR_FOLDER_SIZE = (
    1000  # defines max number of thumbnails in single folder
)

STATIC_DIR: Path = SMOL_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True, parents=True)
# Where thumbnails are written
MODELS_DIR = SMOL_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True, parents=True)

PORT = os.environ.get("PORT", 8000)

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
    ".tiff",
    ".gif",
    ".bmp",
]
READ_ONLY = os.environ.get("READ_ONLY", "False")
if READ_ONLY.lower() == "true":
    READ_ONLY = True
else:
    READ_ONLY = False
AUTO_SCAN = os.environ.get("AUTO_SCAN", "False")
if AUTO_SCAN.lower() == "true":
    AUTO_SCAN = True
else:
    AUTO_SCAN = False

AUTO_SCAN_TIMEFRAME = int(os.environ.get("AUTO_SCAN_TIMEFRAME", 15))

# ------- AI Settings -------------
# Image embedding and text search model
MIN_CLIP_SEARCH_SIMILARITY = float(os.environ.get("MIN_SEARCH_DIST", 0.1))
MIN_CLIP_SIMILARITY = float(os.environ.get("MIN_SIMILARITY_DIST", 0.1))

ENABLE_PEOPLE = os.environ.get("ENABLE_PEOPLE", "False")
if ENABLE_PEOPLE.lower() == "true":
    ENABLE_PEOPLE = True
else:
    ENABLE_PEOPLE = False

AUTO_CLUSTER = os.environ.get("AUTO_CLUSTER", "False")
if AUTO_CLUSTER.lower() == "true":
    AUTO_CLUSTER = True
else:
    AUTO_CLUSTER = False
CLUSTER_BATCH_SIZE = int(os.environ.get("CLUSTER_BATCH_SIZE", 10000))


CLIP_MODEL = os.environ.get("CLIP_MODEL", "xlm-roberta-large-ViT-H-14")
SCENE_EMBEDDING_SIZE = 1024
if CLIP_MODEL == "xlm-roberta-large-ViT-H-14":
    PRETRAINED = "frozen_laion5b_s13b_b90k"
elif CLIP_MODEL == "xlm-roberta-base-ViT-B-32":
    SCENE_EMBEDDING_SIZE = 512
    PRETRAINED = "laion5b_s13b_b90k"
elif CLIP_MODEL == "ViT-L-14":
    PRETRAINED = "laion2b_s32b_b82k"
elif CLIP_MODEL == "ViT-B-32":
    PRETRAINED = "laion2b_s34b_b79k"
elif CLIP_MODEL == "convnext_base_w":
    PRETRAINED = "laion2b_s13b_b82k_augreg"
else:
    logger.error(
        "Not a valid model name: '%s' Please check the tample.env for valid models!",
        CLIP_MODEL,
    )
model, preprocess, _ = open_clip.create_model_and_transforms(
    CLIP_MODEL,
    pretrained=PRETRAINED,
    device="cpu",
)

tokenizer = open_clip.get_tokenizer(CLIP_MODEL)
# face recognition settings
MAX_FRAMES_PER_VIDEO = int(os.environ.get("MAX_FRAMES_PER_VIDEO", 30))
FACE_RECOGNITION_MIN_CONFIDENCE = float(
    os.environ.get("FACE_RECOGNITION_MIN_CONFIDENCE", 0.75)
)
FACE_MATCH_COSINE_THRESHOLD = float(
    os.environ.get("FACE_MATCH_COSINE_THRESHOLD", 0.95)
)
FACE_RECOGNITION_MIN_FACE_PIXELS = int(
    os.environ.get("FACE_RECOGNITION_MIN_FACE_PIXELS", 80 * 80)
)
PERSON_MIN_FACE_COUNT = int(os.environ.get("PERSON_MIN_FACE_COUNT", 2))
