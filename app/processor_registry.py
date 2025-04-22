# app/processor_registry.py
import pkgutil
import importlib
from pathlib import Path
from typing import List

from app.processors.base import MediaProcessor
from app.utils import logger

# this will hold instances of every MediaProcessor
processors: List[MediaProcessor] = []


def load_processors() -> List[MediaProcessor]:
    """
    Scan the app/processors folder, import every module,
    instantiate any MediaProcessor subclasses, and return them.
    """
    # only import once
    if processors:
        return processors

    pkg_path = Path(__file__).parent / "processors"
    for finder, name, ispkg in pkgutil.iter_modules([str(pkg_path)]):
        logger.debug(name)
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
