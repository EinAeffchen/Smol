import pkgutil
import importlib
from pathlib import Path

from app.processors.base import MediaProcessor
from app.logger import logger

processors: list[MediaProcessor] = []


def load_processors() -> list[MediaProcessor]:
    """
    Scan the app/processors folder, import every module,
    instantiate any MediaProcessor subclasses, and return them.
    """
    logger.debug("Loading processors!")
    # only import once
    if processors:
        return processors

    pkg_path = Path(__file__).parent / "processors"
    for finder, name, ispkg in pkgutil.iter_modules([str(pkg_path)]):
        module = importlib.import_module(f"app.processors.{name}")
        for attr in dir(module):
            cls = getattr(module, attr)
            if (
                isinstance(cls, type)
                and issubclass(cls, MediaProcessor)
                and cls is not MediaProcessor
            ):
                processors.append(cls())
    return processors
