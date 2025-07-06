import os
from pathlib import Path
import open_clip
from app.logger import logger
from enum import Enum
from typing import TypeVar

E = TypeVar("E", bound=Enum)

class DuplicateKeepRule(Enum):
    """Defines the set of valid rules for keeping a duplicate file."""
    BIGGEST = "biggest"
    SMALLEST = "smallest"
    HIGHEST_RES = "highest_res"
    LOWEST_RES = "lowest_res"
    OLDEST = "oldest"
    NEWEST = "newest"

    @classmethod
    def get_default(cls):
        return cls.OLDEST
    
    def __str__(self):
        return self.value

class ClipModel(Enum):
    ROBERTA_LARGE_VIT_H_14 = (
        "xlm-roberta-large-ViT-H-14", 1024, "frozen_laion5b_s13b_b90k"
    )
    ROBERTA_BASE_VIT_B_32 = (
        "xlm-roberta-base-ViT-B-32", 512, "laion5b_s13b_b90k"
    )
    VIT_L_14 = (
        "ViT-L-14", 768, "laion2b_s32b_b82k"
    )
    VIT_B_32 = (
        "ViT-B-32", 512, "laion2b_s34b_b79k" 
    )
    CONVNEXT_BASE_W = (
        "convnext_base_w", 640, "laion2b_s13b_b82k_augreg"
    )
    
    def __init__(self, model_name: str, embedding_size: int, pretrained: str):
        """
        This initializer is called for each member, assigning the tuple
        values to attributes on the member itself.
        """
        self.model_name = model_name
        self.embedding_size = embedding_size
        self.pretrained = pretrained

    @classmethod
    def _missing_(cls, value: object):
        """
        Custom hook for looking up a member by its model_name string.
        """
        if not isinstance(value, str):
            return None
        
        for member in cls:
            if member.model_name.lower() == value.lower():
                return member
        return None
    
    @classmethod
    def get_default(cls):
        # Define the default model
        return cls.ROBERTA_LARGE_VIT_H_14
    
    def __str__(self):
        return self.model_name

def parse_env_into_enum(env_name: str, enum_class: type[E]) -> E:
    default_value_str = enum_class.get_default().value
    value_str = os.environ.get(env_name, default_value_str)

    try:
        enum_member = enum_class(value_str.lower())
        if enum_member is None:
            # This handles the case where _missing_ returns None
            raise ValueError(f"No matching enum member found for '{value_str}'")
        return enum_member
    except ValueError:
        valid_options = ", ".join([member.value for member in enum_class])
        raise ValueError(
            f"Invalid value for {env_name}: '{value_str}'. "
            f"Must be one of: {valid_options}"
        )

def parse_env_into_bool(env_name: str, default: str) -> bool:
    bool_env = os.environ.get(env_name, default)
    if bool_env.lower() == "true":
        bool_env = True
    else:
        bool_env = False
    return bool_env

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
READ_ONLY = parse_env_into_bool("READ_ONLY", "false")
AUTO_SCAN = parse_env_into_bool("AUTO_SCAN", "false")

AUTO_SCAN_TIMEFRAME = int(os.environ.get("AUTO_SCAN_TIMEFRAME", 15))

# ------- AI Settings -------------
# Image embedding and text search model
MIN_CLIP_SEARCH_SIMILARITY = float(os.environ.get("MIN_SEARCH_DIST", 0.1))
MIN_CLIP_SIMILARITY = float(os.environ.get("MIN_SIMILARITY_DIST", 0.1))

ENABLE_PEOPLE = parse_env_into_bool("ENABLE_PEOPLE", "false")
AUTO_ROTATE = parse_env_into_bool("AUTO_ROTATE", "false")

AUTO_CLUSTER = parse_env_into_bool("AUTO_CLUSTER", "false")

CLUSTER_BATCH_SIZE = int(os.environ.get("CLUSTER_BATCH_SIZE", 10000))


SELECTED_MODEL: ClipModel = parse_env_into_enum("CLIP_MODEL", ClipModel)
CLIP_MODEL = SELECTED_MODEL.model_name
SCENE_EMBEDDING_SIZE = SELECTED_MODEL.embedding_size
PRETRAINED = SELECTED_MODEL.pretrained
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

# duplicate settings
DUPLICATE_AUTO_REMOVE = parse_env_into_bool("DUPLICATE_AUTO_REMOVE", "false")

DUPLICATE_AUTO_KEEP_RULE = parse_env_into_enum("DUPLICATE_AUTO_KEEP_RULE", DuplicateKeepRule)
