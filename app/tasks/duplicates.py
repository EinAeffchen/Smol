from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, text
from sqlmodel import Session

import app.database as db
from app.concurrency import heavy_writer
from app.logger import logger
from app.models import DuplicateMedia, ProcessingTask
from app.processors.duplicates import DuplicateProcessor
from .hashes import generate_hashes

__all__ = ["run_duplicate_detection"]


def run_duplicate_detection(task_id: str, threshold: int) -> None:
    with Session(db.engine) as session:
        task = session.get(ProcessingTask, task_id)
        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        session.commit()

    def is_cancelled() -> bool:
        with Session(db.engine) as s:
            t = s.get(ProcessingTask, task_id)
            return bool(t and t.status == "cancelled")

    with heavy_writer(name="find_duplicates", cancelled=is_cancelled):
        generate_hashes(task_id)
        processor = DuplicateProcessor(task_id, threshold)
        processor.process()

    with Session(db.engine) as session:
        empty_groups = session.exec(
            text(
                """
                SELECT group_id FROM (
                    SELECT group_id, COUNT(*) as cnt
                    FROM duplicatemedia
                    GROUP BY group_id
                ) WHERE cnt < 2
                """
            )
        ).all()
        if empty_groups:
            logger.info(
                "Cleaning up %d empty duplicate groups", len(empty_groups)
            )
            session.exec(
                delete(DuplicateMedia).where(
                    DuplicateMedia.group_id.in_([row[0] for row in empty_groups])
                )
            )
            session.commit()
