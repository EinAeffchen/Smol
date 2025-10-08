from __future__ import annotations

from sqlmodel import Session

import app.database as db
from app.config import settings
from app.logger import logger
from app.models import ProcessingTask
from .maintenance import clean_missing_files
from .media_processing import run_media_processing_and_chain
from .scan import run_scan

__all__ = ["run_cleanup_and_chain", "run_scan_and_chain"]


def run_cleanup_and_chain(task_id: str) -> None:
    if settings.scan.auto_clean_on_scan:
        clean_missing_files(task_id)

    logger.info("Cleanup task finished, starting scan task.")
    with Session(db.engine) as new_session:
        next_task = ProcessingTask(task_type="scan", total=0, processed=0)
        new_session.add(next_task)
        new_session.commit()
        new_session.refresh(next_task)

    run_scan_and_chain(next_task.id)


def run_scan_and_chain(task_id: str) -> None:
    run_scan(task_id)

    logger.info("Scan task finished, starting media processing task.")
    with Session(db.engine) as new_session:
        next_task = ProcessingTask(
            task_type="process_media", total=0, processed=0
        )
        new_session.add(next_task)
        new_session.commit()
        new_session.refresh(next_task)

    run_media_processing_and_chain(next_task.id)
