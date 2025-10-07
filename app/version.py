from __future__ import annotations

import os
from importlib import metadata, resources
from pathlib import Path
from typing import Optional

PACKAGE_NAME = "omoide"
VERSION_FILENAME = "VERSION"
DEFAULT_VERSION = "0.0.0-dev"


def _read_env_version() -> Optional[str]:
    value = os.getenv("OMOIDE_VERSION")
    return value if value else None


def _read_package_metadata() -> Optional[str]:
    try:
        return metadata.version(PACKAGE_NAME)
    except metadata.PackageNotFoundError:
        return None


def _read_bundled_version() -> Optional[str]:
    try:
        version_path = resources.files(__package__).joinpath(VERSION_FILENAME)
        return version_path.read_text(encoding="utf-8").strip()
    except (FileNotFoundError, ModuleNotFoundError, AttributeError):
        # AttributeError can be raised by resources.files on some Python <3.9 fallbacks
        try:
            with resources.open_text(__package__, VERSION_FILENAME) as fh:
                return fh.read().strip()
        except (FileNotFoundError, ModuleNotFoundError):
            return None


def _read_pyproject_version() -> Optional[str]:
    try:
        import tomllib  # Python 3.11+
    except ModuleNotFoundError:
        return None

    pyproject_path = Path(__file__).resolve().parent.parent / "pyproject.toml"
    if not pyproject_path.exists():
        return None
    try:
        data = tomllib.loads(pyproject_path.read_text(encoding="utf-8"))
    except (tomllib.TOMLDecodeError, OSError):
        return None
    project = data.get("project") or {}
    version = project.get("version")
    return str(version) if version else None


def get_app_version() -> str:
    """
    Determine the application version in order of preference:
    1. Explicit OMOIDE_VERSION environment variable (set by CI / runtime wrappers)
    2. Packaged metadata when installed as a Python distribution
    3. Bundled VERSION file (for PyInstaller or similar)
    4. pyproject.toml in source checkouts
    5. DEFAULT_VERSION constant as the final fallback
    """

    for resolver in (
        _read_env_version,
        _read_package_metadata,
        _read_bundled_version,
        _read_pyproject_version,
    ):
        resolved = resolver()
        if resolved:
            return resolved
    return DEFAULT_VERSION
