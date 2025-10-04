"""Utility helpers for subprocess usage across platforms."""

from __future__ import annotations

import subprocess
import sys
from typing import Any

__all__ = ["run_silent", "popen_silent", "apply_no_window_flags"]

_ORIGINAL_RUN = subprocess.run
_ORIGINAL_POPEN = subprocess.Popen


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


def run_silent(cmd: Any, *args: Any, **kwargs: Any) -> subprocess.CompletedProcess[Any]:
    """Wrapper around subprocess.run that hides the console window on Windows."""
    kwargs = apply_no_window_flags(kwargs)
    return _ORIGINAL_RUN(cmd, *args, **kwargs)


def popen_silent(cmd: Any, *args: Any, **kwargs: Any) -> subprocess.Popen[Any]:
    """Wrapper around subprocess.Popen that hides the console window on Windows."""
    kwargs = apply_no_window_flags(kwargs)
    return _ORIGINAL_POPEN(cmd, *args, **kwargs)


def _patch_ffmpeg_windows_popens() -> None:
    """Ensure ffmpeg-python subprocesses inherit the no-window flags on Windows."""
    if not sys.platform.startswith("win"):
        return
    try:
        import ffmpeg._run as ffmpeg_run  # type: ignore
    except Exception:
        return
    if getattr(ffmpeg_run, "_omoide_no_console_patch", False):
        return

    original_popen = ffmpeg_run.subprocess.Popen

    def _wrapped_popen(cmd: Any, *args: Any, **kwargs: Any) -> subprocess.Popen[Any]:
        kwargs = apply_no_window_flags(kwargs)
        return original_popen(cmd, *args, **kwargs)

    ffmpeg_run.subprocess.Popen = _wrapped_popen  # type: ignore[assignment]
    ffmpeg_run._omoide_no_console_patch = True
    ffmpeg_run._omoide_original_popen = original_popen


_patch_ffmpeg_windows_popens()
