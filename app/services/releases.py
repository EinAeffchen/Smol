from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, TypedDict
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    from packaging import version as packaging_version
except ImportError:  # pragma: no cover - fallback when packaging isn't installed
    packaging_version = None  # type: ignore

ReleaseInfo = TypedDict(
    "ReleaseInfo",
    {
        "tag_name": str | None,
        "name": str | None,
        "html_url": str | None,
        "published_at": str | None,
    },
    total=False,
)

CachedResult = TypedDict(
    "CachedResult",
    {
        "fetched_at": datetime,
        "release": ReleaseInfo | None,
        "error": str | None,
    },
)

_cache_lock = threading.Lock()
_cache: dict[str, CachedResult] = {}


def _normalize_version(raw: str | None) -> str | None:
    if not raw:
        return None
    value = raw.strip()
    if value.startswith(("v", "V")):
        value = value[1:]
    return value


def _fetch_latest_release(
    repo: str,
    timeout: float,
) -> ReleaseInfo:
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    request = Request(
        url,
        headers={
            "User-Agent": "omoide-update-check/1.0",
            "Accept": "application/vnd.github+json",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        payload = response.read()
    data: dict[str, Any] = json.loads(payload)
    return {
        "tag_name": data.get("tag_name"),
        "name": data.get("name"),
        "html_url": data.get("html_url"),
        "published_at": data.get("published_at"),
    }


def get_latest_release_info(
    repo: str,
    current_version: str,
    cache_minutes: int = 180,
    timeout: float = 5.0,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    cache_key = repo.lower().strip()
    with _cache_lock:
        cache_entry = _cache.get(cache_key)
        if (
            cache_entry
            and now - cache_entry["fetched_at"] < timedelta(minutes=cache_minutes)
        ):
            release = cache_entry["release"]
            error = cache_entry["error"]
        else:
            try:
                release = _fetch_latest_release(repo, timeout=timeout)
                error = None
            except (HTTPError, URLError, TimeoutError) as exc:
                release = None
                error = f"{exc.__class__.__name__}: {exc}"
            except Exception as exc:  # pragma: no cover - defensive
                release = None
                error = f"Unexpected error: {exc}"
            _cache[cache_key] = {
                "fetched_at": now,
                "release": release,
                "error": error,
            }

    latest_tag = release["tag_name"] if release else None
    latest_version = _normalize_version(latest_tag) or _normalize_version(
        release["name"] if release else None
    )
    normalized_current = _normalize_version(current_version) or current_version

    update_available = False
    comparison_error: str | None = None
    if latest_version:
        if packaging_version:
            try:
                update_available = (
                    packaging_version.parse(latest_version)
                    > packaging_version.parse(normalized_current)
                )
            except Exception as exc:  # pragma: no cover - defensive
                comparison_error = f"version-compare-error: {exc}"
                update_available = latest_version != normalized_current
        else:
            update_available = latest_version != normalized_current

    return {
        "update_check_enabled": True,
        "repo": repo,
        "current_version": current_version,
        "latest_tag": latest_tag,
        "latest_version": latest_version,
        "update_available": bool(update_available),
        "release_url": release["html_url"] if release else None,
        "published_at": release["published_at"] if release else None,
        "checked_at": now.isoformat(),
        "error": error or comparison_error,
    }
