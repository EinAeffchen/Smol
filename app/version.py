from __future__ import annotations

import os
from importlib import metadata

PACKAGE_NAME = "omoide"
DEFAULT_VERSION = "0.1.9"


def get_app_version() -> str:
    env_version = os.getenv("OMOIDE_VERSION")
    if env_version:
        return env_version
    try:
        return metadata.version(PACKAGE_NAME)
    except metadata.PackageNotFoundError:
        return DEFAULT_VERSION
