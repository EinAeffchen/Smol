from fastapi import APIRouter, HTTPException
from app.config import settings, AppSettings, save_settings, reload_settings

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
