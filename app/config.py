import os
import sys
from enum import Enum
from pathlib import Path
from typing import TypeVar

import open_clip
import yaml
from pydantic import BaseModel, Field, PlainSerializer
from typing_extensions import Annotated

from app.logger import logger

E = TypeVar("E", bound=Enum)
IS_DOCKER = os.getenv("IS_DOCKER", False)


def get_user_data_path() -> Path:
    """Gets the path to the config file in the user's app data directory."""
    if IS_DOCKER:
        return Path("/app/data")
    app_data_dir = Path(
        os.getenv("APPDATA")
        or os.getenv("XDG_CONFIG_HOME")
        or Path.home() / ".config"
    )
    app_config_dir = app_data_dir / "Smol"  # Use your actual app name
    app_config_dir.mkdir(parents=True, exist_ok=True)
    return app_config_dir


def get_static_assets_dir() -> Path:
    """
    Gets the correct path to the static assets folder for PyInstaller,
    Docker, and local development environments.
    """
    # 1. Check if running as a bundled executable (PyInstaller)
    static_dir = Path("dist/assets")
    logger.info(
        "STATE: %s - %s",
        getattr(sys, "frozen", False),
        hasattr(sys, "_MEIPASS"),
    )
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        # The path is absolute, inside the temporary _MEIPASS directory
        # This must match the DESTINATION part of your --add-data flag
        # e.g., --add-data "frontend/dist:dist"
        base_path = Path(sys._MEIPASS)
        logger.info("Base path: %s", base_path)
        static_dir = base_path / "dist"

    # 2. Check if running inside our Docker container via an env var
    elif os.environ.get("IS_DOCKER"):
        # The path is absolute within the container
        static_dir = Path("/app/static")

    # 3. Fallback to local development path
    static_dir.mkdir(exist_ok=True, parents=True)
    logger.debug("StATIC DIR: %s", static_dir)
    return static_dir


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


class DuplicateHandlingRule(Enum):
    """Defines the set of valid rules for keeping a duplicate file."""

    KEEP = "keep"
    REMOVE = "remove"
    BLACKLIST = "blacklist"
    DELETE = "delete"

    @classmethod
    def get_default(cls):
        return cls.KEEP

    def __str__(self):
        return self.value


class ClipModel(Enum):
    ROBERTA_LARGE_VIT_H_14 = (
        "xlm-roberta-large-ViT-H-14",
        1024,
        "frozen_laion5b_s13b_b90k",
    )
    ROBERTA_BASE_VIT_B_32 = (
        "xlm-roberta-base-ViT-B-32",
        512,
        "laion5b_s13b_b90k",
    )
    VIT_L_14 = ("ViT-L-14", 768, "laion2b_s32b_b82k")
    VIT_B_32 = ("ViT-B-32", 512, "laion2b_s34b_b79k")
    CONVNEXT_BASE_W = ("convnext_base_w", 640, "laion2b_s13b_b82k_augreg")

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
        """This custom hook correctly finds an enum member from a string."""
        if isinstance(value, str):
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


# TODO ensure read_only and read/write settings diff
# TODO ensure future changes in settings are written into already known file
class GeneralSettings(BaseModel):
    port: int = 8000
    # Run system in read_only mode or not
    read_only: bool = False
    # Enable face recognition and other person related features
    enable_people: bool = True
    is_docker: bool = os.environ.get("IS_DOCKER", False)
    # Whether the app is running as a packaged/binary executable (e.g., PyInstaller)
    is_binary: bool = bool(getattr(sys, "frozen", False))
    # Which host the system runs on. Mostly only relevant if hosted online.
    domain: str = f"http://localhost:{port}"
    # maximum number of thumbnails per folder, adjust according to your systems inodes
    thumb_dir_folder_size: int = 1000

    data_dir: Path = get_user_data_path()
    database_dir: Path = data_dir / "database"
    smol_dir: Path = data_dir / ".smol"
    thumb_dir: Path = smol_dir / "thumbnails"
    # only relevant when run as binary
    media_dirs: list[Path] = []
    static_dir: Path = get_static_assets_dir()
    models_dir: Path = smol_dir / "models"
    database_url: str = f"sqlite:///{database_dir}/smol.db?cache=shared&mode=rwc&_journal_mode=WAL&_synchronous=NORMAL"

    def model_post_init(self, context) -> None:
        self.database_dir.mkdir(parents=True, exist_ok=True)
        self.smol_dir.mkdir(parents=False, exist_ok=True)
        self.thumb_dir.mkdir(exist_ok=True)
        self.models_dir.mkdir(exist_ok=True)
        if IS_DOCKER:
            self.media_dirs = [Path("/app/media")]


class TaggingSettings(BaseModel):
    auto_tagging: bool = True
    # whether to use the default system defined tags.
    use_default_tags: bool = True
    # add any tags in any language supported by the chosen clip model
    custom_tags: list[str] = []


class ScanSettings(BaseModel):
    # enables automatic background scans for new files
    auto_scan: bool = False
    # How often to scan for files in minutes
    scan_interval_minutes: int = 15
    # If autoscan should also automatically clean the database from missing files
    auto_clean_on_scan: bool = False
    # If autoscan should also automatically cluster all faces.
    # Not recommended if you manually adjusted people
    auto_cluster_on_scan: bool = False
    # sometimes images are rotated based on their exif data
    # this is automatically caught by most apps and the user doesn't notice
    # this option automatically rotates them to the correct direction and removes
    # the exif rotation information
    auto_rotate: bool = True
    VIDEO_SUFFIXES: list[str] = [
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
    IMAGE_SUFFIXES: list[str] = [
        ".jpg",
        ".jpeg",
        ".png",
        ".tiff",
        ".gif",
        ".bmp",
    ]


class AISettings(BaseModel):
    # which model to use for image processing. Options:
    # 1. xlm-roberta-large-ViT-H-14 -> Cross language large model
    # 2. xlm-roberta-base-ViT-B-32 -> Cross language small model
    # Below models are not tested yet and might need adjustments on the database
    # vector sizes
    # 3. ViT-L-14 -> english only large model
    # 4. laion2b_s32b_b82k -> english only large model
    # 5. ViT-B-32 -> english only base model
    # 6. convnext_base_w -> english only convolution base model
    clip_model: Annotated[
        ClipModel,
        PlainSerializer(lambda x: x.model_name, return_type=str),
    ] = ClipModel.ROBERTA_BASE_VIT_B_32

    # @computed_field
    @property
    def clip_model_embedding_size(self) -> int:
        return self.clip_model.embedding_size

    # @computed_field
    @property
    def clip_model_pretrained(self) -> str:
        return self.clip_model.pretrained

    # Strictness of the search results. Higher -> more accurate but less hits
    min_search_dist: float = 0.68
    # Defines the maximum distance for similarity between two images.
    # Used to reduce/increase number of similar images. Higher -> stronger similarity
    min_similarity_dist: float = 1.2
    # reduce if ram is an issue, the higher the more accurate the clustering.
    cluster_batch_size: int = 10000


class FaceRecognitionSettings(BaseModel):
    # minimum confidence needed to extract a face
    face_recognition_min_confidence: float = 0.5
    # minimum threshold for a face needed to be matched to a person
    face_match_cosine_threshold: float = 0.40
    # minimum size of a face in pixels to be detected. Base size for detection
    # is the original image, not a thumbnail!
    face_recognition_min_face_pixels: int = 1600
    # number of faces needed to automatically create a person
    person_min_face_count: int = 2


class DuplicateSettings(BaseModel):
    """Defines how to handle detected duplicate files"""

    # what to do with duplicates. Default = Keep = do nothing automatically
    duplicate_auto_handling: DuplicateHandlingRule = DuplicateHandlingRule.KEEP
    # Which image/video to keep in case auto_handling != keep
    duplicate_auto_keep_rule: DuplicateKeepRule = DuplicateKeepRule.HIGHEST_RES


class VideoSettings(BaseModel):
    """These settings control the video processing. By default we automatically
    detect scenes in a video and retrieve thumbnails for the scene overlay
    and the content searchability. If scene detection fails we split videos every
    n seconds into a maximum of :max_frames_per_video scenes."""

    # automatically detect scenes to split video into images
    auto_scene_detection: bool = True
    # Max number of frames detected per video if automatic scene detection fails
    max_frames_per_video: int = 30


class ContentProcessorSettings(BaseModel):
    # extract exif data from images/videos
    exif_processor_active: bool = True
    # extract faces from content. Only active when enable_people=true.
    face_processor_active: bool = True
    # image embedding creator active. Needed for all AI related features
    # if you want to deactivate all smart features, set this to False
    image_embedding_processor_active: bool = True


class AppSettings(BaseModel):
    general: GeneralSettings = Field(default_factory=GeneralSettings)
    scan: ScanSettings = Field(default_factory=ScanSettings)
    ai: AISettings = Field(default_factory=AISettings)
    tagging: TaggingSettings = Field(default_factory=TaggingSettings)
    face_recognition: FaceRecognitionSettings = Field(
        default_factory=FaceRecognitionSettings
    )
    duplicates: DuplicateSettings = Field(default_factory=DuplicateSettings)
    video: VideoSettings = Field(default_factory=VideoSettings)
    processors: ContentProcessorSettings = Field(
        default_factory=ContentProcessorSettings
    )


def load_config_from_file() -> dict:
    """Loads settings from the user's YAML file."""
    config_path = get_user_data_path() / "config.yaml"
    if not config_path.exists():
        save_settings(AppSettings())
    with open(config_path, "r") as f:
        return yaml.safe_load(f) or {}


def load_settings() -> AppSettings:
    """
    Loads settings with a clear priority:
    1. Environment variables (for Docker)
    2. User's config.yaml file (for desktop app)
    3. Pydantic model defaults (hardcoded fallback)
    """
    # Start with an empty dict
    config_data = {}

    # 1. Load from user's config.yaml file
    file_config = load_config_from_file()
    if file_config:
        config_data.update(file_config)

    # 3. Load into Pydantic model. This applies defaults for any missing values.
    return AppSettings.model_validate(config_data)


def save_settings(settings_model: AppSettings):
    """Saves the provided settings model to the config.yaml file."""
    config_file = get_user_data_path() / "config.yaml"
    with open(config_file, "w") as f:
        # `sort_keys=False` helps maintain the order from your Pydantic model
        yaml.dump(
            settings_model.model_dump(mode="json"),
            f,
            sort_keys=False,
            indent=2,
        )


def get_model(settings: AppSettings):
    model, preprocess, _ = open_clip.create_model_and_transforms(
        settings.ai.clip_model.model_name,
        pretrained=settings.ai.clip_model_pretrained,
        device="cpu",
    )

    tokenizer = open_clip.get_tokenizer(settings.ai.clip_model.model_name)
    return model, preprocess, tokenizer


def reload_settings():
    """Reloads the settings and the model."""
    global settings, model, preprocess, tokenizer
    logger.info("Reloading settings...")
    new_settings = load_settings()
    # Update the existing settings object in place
    for section_name, section_settings in new_settings.model_dump().items():
        if hasattr(settings, section_name):
            section = getattr(settings, section_name)
            for key, value in section_settings.items():
                if section_name == "ai" and key == "clip_model":
                    setattr(section, key, ClipModel(value))
                else:
                    setattr(section, key, value)

    model, preprocess, tokenizer = get_model(settings)
    logger.info("Settings reloaded successfully.")


settings = load_settings()
model, preprocess, tokenizer = get_model(settings)
logger.info("DATA_DIR: %s", settings.general.data_dir)
