from app.processors.base import MediaProcessor
from app.logger import logger

# Explicit imports ensure PyInstaller bundles these modules
# and avoids relying on filesystem scanning at runtime.
from app.processors.exif import ExifProcessor
from app.processors.embedding_extractor import EmbeddingExtractor
from app.processors.faces import FaceProcessor
from app.processors.auto_tagger import AutoTagger

processors: list[MediaProcessor] = []


def load_processors() -> list[MediaProcessor]:
    """
    Return a statically‑registered list of processors.

    Notes:
    - Dynamic discovery via pkgutil/importlib breaks in frozen binaries
      because files are bundled and not laid out on disk.
    - We explicitly import and instantiate known processors so they are
      included in the binary and reliably available at runtime.
    """
    logger.debug("Loading processors!")
    if processors:
        return processors

    # Keep order stable by class 'order' attribute
    known_processor_classes: list[type[MediaProcessor]] = [
        ExifProcessor,
        EmbeddingExtractor,
        FaceProcessor,
        AutoTagger,
    ]

    loaded = [cls() for cls in known_processor_classes]
    loaded.sort(key=lambda p: p.order)
    processors.extend(loaded)
    logger.info("Processors loaded in order: %s", [p.name for p in processors])
    return processors
