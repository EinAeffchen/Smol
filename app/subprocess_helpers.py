"""Utility helpers for subprocess usage across platforms."""

from __future__ import annotations

import subprocess
import sys
from typing import Any

__all__ = ["run_silent", "popen_silent", "apply_no_window_flags"]


def apply_no_window_flags(kwargs: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of kwargs with Windows console windows suppressed."""
    if not sys.platform.startswith("win"):
        return dict(kwargs)

    updated = dict(kwargs)
    creationflags = updated.get("creationflags", 0)
    creationflags |= subprocess.CREATE_NO_WINDOW
    updated["creationflags"] = creationflags

    startupinfo = updated.get("startupinfo")
    if startupinfo is None:
        startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    updated["startupinfo"] = startupinfo
    return updated


def run_silent(cmd: list[str] | tuple[str, ...], **kwargs: Any) -> subprocess.CompletedProcess[Any]:
    """Wrapper around subprocess.run that hides the console window on Windows."""
    return subprocess.run(cmd, **apply_no_window_flags(kwargs))


def popen_silent(cmd: list[str] | tuple[str, ...], **kwargs: Any) -> subprocess.Popen[Any]:
    """Wrapper around subprocess.Popen that hides the console window on Windows."""
    return subprocess.Popen(cmd, **apply_no_window_flags(kwargs))
