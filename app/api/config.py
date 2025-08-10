from fastapi import APIRouter, Depends
from app.config import settings, AppSettings, save_settings

router = APIRouter()


@router.get("/config", response_model=AppSettings)
def get_config():
    return settings


@router.post("/config", response_model=AppSettings)
def update_config(config: AppSettings):
    save_settings(config)
    return config
