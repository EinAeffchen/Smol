import os
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import (
    settings,
    AppSettings,
    save_settings,
    reload_settings,
)
from app.config import read_bootstrap, write_bootstrap

router = APIRouter()


@router.post("/reload", status_code=204)
async def reload_settings_endpoint():
    """Reloads the settings from the config.yaml file."""
    reload_settings()


@router.get("/", response_model=AppSettings)
async def get_settings():
    """Returns the current settings model."""
    return settings


@router.post("/", response_model=AppSettings)
async def save_settings_endpoint(
    settings_model: AppSettings,
):
    """Saves the settings model to the config.yaml file."""
    save_settings(settings_model)
    return settings_model


@router.get("/pick-directory")
def pick_directory():
    """
    Opens a native folder selection dialog and returns the chosen path.
    Only meaningful for local/binary usage; not supported in Docker.
    """
    if settings.general.is_docker:
        raise HTTPException(status_code=400, detail="Folder picker not available in Docker.")

    # Prefer enabling this when running as a packaged/binary app
    # but keep it available for local dev as well.
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        try:
            # Bring dialog to front
            root.wm_attributes("-topmost", 1)
        except Exception:
            pass
        path = filedialog.askdirectory()
        try:
            root.destroy()
        except Exception:
            pass
        return {"path": path or ""}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Folder picker failed: {e}")


@router.get("/profiles")
def list_profiles():
    if settings.general.is_docker:
        raise HTTPException(status_code=400, detail="Profiles not supported in Docker.")
    bs = read_bootstrap() or {}
    return {
        "active_path": bs.get("active_profile", str(settings.general.data_dir)),
        "profiles": bs.get("profiles", []),
    }


class SwitchProfileRequest(BaseModel):
    path: str


@router.post("/profiles/switch", status_code=204)
def switch_profile(req: SwitchProfileRequest):
    if settings.general.is_docker:
        raise HTTPException(status_code=400, detail="Switching profiles not supported in Docker.")
    dest = Path(req.path).expanduser().resolve()
    dest.mkdir(parents=True, exist_ok=True)

    bs = read_bootstrap() or {}
    profiles = bs.get("profiles", [])
    # ensure profile exists in list
    if not any(p.get("path") == str(dest) for p in profiles):
        profiles.append({"name": dest.name or "Profile", "path": str(dest)})
    bs["profiles"] = profiles
    bs["active_profile"] = str(dest)
    write_bootstrap(bs)
    reload_settings()


class CreateProfileRequest(BaseModel):
    path: str
    name: str | None = None


@router.post("/profiles/create", status_code=204)
def create_profile(req: CreateProfileRequest):
    if settings.general.is_docker:
        raise HTTPException(status_code=400, detail="Creating profiles not supported in Docker.")
    dest = Path(req.path).expanduser().resolve()
    if dest.exists() and any(dest.iterdir()):
        raise HTTPException(status_code=400, detail="Destination exists and is not empty.")
    dest.mkdir(parents=True, exist_ok=True)

    # Create a fresh config in the new profile upon switch via reload

    bs = read_bootstrap() or {}
    profiles = bs.get("profiles", [])
    name = req.name or (dest.name or "Profile")
    if not any(p.get("path") == str(dest) for p in profiles):
        profiles.append({"name": name, "path": str(dest)})
    bs["profiles"] = profiles
    bs["active_profile"] = str(dest)
    write_bootstrap(bs)
    reload_settings()


class MoveDataRequest(BaseModel):
    dest_path: str


@router.post("/move-data", status_code=204)
def move_data(req: MoveDataRequest):
    if settings.general.is_docker:
        raise HTTPException(status_code=400, detail="Moving data not supported in Docker.")

    src = Path(settings.general.data_dir).resolve()
    dest = Path(req.dest_path).expanduser().resolve()

    if src == dest:
        return  # no-op
    if str(dest).startswith(str(src)):
        raise HTTPException(status_code=400, detail="Destination cannot be within the source directory.")
    if dest.exists():
        if any(dest.iterdir()):
            raise HTTPException(status_code=400, detail="Destination exists and is not empty.")
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Move the entire profile directory to the new location
        shutil.move(str(src), str(dest))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Move failed: {e}")

    # Update bootstrap to the new path
    bs = read_bootstrap() or {}
    profiles = bs.get("profiles", [])
    updated = False
    for p in profiles:
        if p.get("path") == str(src):
            p["path"] = str(dest)
            updated = True
            break
    if not updated:
        profiles.append({"name": dest.name or "Profile", "path": str(dest)})
    bs["profiles"] = profiles
    bs["active_profile"] = str(dest)
    write_bootstrap(bs)
    reload_settings()
