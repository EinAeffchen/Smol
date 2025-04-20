# smol/smol/celery.py
from __future__ import annotations
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "smol.settings")
app = Celery("smol")
app.config_from_object("django.conf:settings", namespace="CELERY")

# auto‑discover tasks in all INSTALLED_APPS
app.autodiscover_tasks()

# Beat schedule: scan every 1 minute
app.conf.beat_schedule = {
    "scan-for-new-files": {
        "task": "viewer.tasks.scan_for_new_files",
        "schedule": crontab(second="*/30"),
    },
}
