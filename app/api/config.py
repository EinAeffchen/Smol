from fastapi import APIRouter
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
