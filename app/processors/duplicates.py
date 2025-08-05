from sqlmodel import Session, select, delete, update
from app.database import engine
from app.logger import logger
from app.models import Media, ProcessingTask, DuplicateGroup, DuplicateMedia
from sqlalchemy import func
from datetime import datetime, timezone
from app.config import settings, DuplicateHandlingRule

class UnionFind:
    def __init__(self, elements):
        self.parent = {el: el for el in elements}

    def find(self, i):
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]

    def union(self, i, j):
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            self.parent[root_j] = root_i


class DuplicateProcessor:
    name = "duplicate_processor"
    def __init__(
        self, task_id: str, threshold: int = 4
    ):  # Note: threshold is now an integer Hamming distance
        self.task_id = task_id
        self.threshold = threshold  # A threshold of 0-5 is common for pHash

    def _update_task_progress_and_check_status(
        self, session: Session, processed: int, total: int
    ) -> bool | None:
        task = session.get(ProcessingTask, self.task_id)
        if task:
            task.processed = processed
            task.total = total
            session.add(task)
            session.commit()
            session.refresh(task)
            if task.status == "cancelled":
                return True

    def _update_task_status(self, session: Session, status: str):
        task = session.get(ProcessingTask, self.task_id)
        if task:
            task.status = status
            task.started_at = datetime.now(timezone.utc)
            if status == "completed" or status == "failed":
                task.finished_at = datetime.now(timezone.utc)
            session.add(task)
            session.commit()
            session.refresh(task)

    def process(self):
        with Session(engine) as session:
            self._update_task_status(session, "running")
            logger.info(
                f"Starting pHash duplicate detection task {self.task_id}"
            )

            try:
                # --- Phase 1: Group by IDENTICAL Hashes ---

                # Find all hashes that appear more than once
                stmt = (
                    select(Media.phash, func.count(Media.id).label("count"))
                    .where(Media.phash.is_not(None))
                    .group_by(Media.phash)
                    .having(func.count(Media.id) > 1)
                )
                duplicate_hashes = session.exec(stmt).all()

                # For each duplicate hash, find all associated media
                for phash, count in duplicate_hashes:
                    media_with_same_hash_stmt = select(Media).where(
                        Media.phash == phash
                    )
                    media_items = session.exec(media_with_same_hash_stmt).all()
                    media_ids = [m.id for m in media_items]

                    if settings.duplicates.duplicate_auto_handling is DuplicateHandlingRule.KEEP:
                        # This function will handle creating/merging groups and committing
                        self._create_or_update_group(session, media_ids)
                    else:
                        pass#TODO


                logger.info(
                    f"Completed grouping {len(duplicate_hashes)} sets of identical images."
                )
                self._update_task_progress_and_check_status(
                    session, 1, 2
                ) 

                self._update_task_status(session, "completed")
                logger.info("pHash duplicate detection task finished.")

            except Exception as e:
                logger.error(
                    f"Duplicate detection task {self.task_id} failed: {e}",
                    exc_info=True,
                )
                self._update_task_status(session, "failed")

    def _create_or_update_group(self, session: Session, media_ids: list[int]):
        """
        Takes a list of media IDs that are duplicates and puts them in the same group.
        Handles merging if some items are already in different groups.
        This is a transactional unit of work that COMMITS at the end.
        """
        if not media_ids:
            return

        # Find all existing groups these media belong to
        existing_groups_stmt = select(DuplicateMedia).where(
            DuplicateMedia.media_id.in_(media_ids)
        )
        existing_dms = session.exec(existing_groups_stmt).all()

        connected_group_ids = {dm.group_id for dm in existing_dms}

        if not connected_group_ids:
            # No existing groups, create a new one
            new_group = DuplicateGroup()
            session.add(new_group)
            session.flush()  # Assigns an ID to new_group
            target_group_id = new_group.id
        else:
            # Items belong to existing groups, merge them all into the smallest group ID
            target_group_id = min(connected_group_ids)

        # Create a list of mappings for bulk insertion
        new_duplicate_mappings = []
        for media_id in media_ids:
            # Check if this media is already in the target group
            is_already_in_target_group = any(
                dm.media_id == media_id and dm.group_id == target_group_id
                for dm in existing_dms
            )
            if not is_already_in_target_group:
                new_duplicate_mappings.append(
                    {"group_id": target_group_id, "media_id": media_id}
                )

        # Delete old entries for these media ids before inserting new ones
        if existing_dms:
            ids_to_delete = [dm.media_id for dm in existing_dms]
            session.exec(
                delete(DuplicateMedia).where(
                    DuplicateMedia.media_id.in_(ids_to_delete)
                )
            )

        # Bulk insert new mappings
        if new_duplicate_mappings:
            session.bulk_insert_mappings(
                DuplicateMedia, new_duplicate_mappings
            )

        # Merge other groups into the target group if necessary
        if len(connected_group_ids) > 1:
            other_group_ids = [
                gid for gid in connected_group_ids if gid != target_group_id
            ]
            session.exec(
                update(DuplicateMedia)
                .where(DuplicateMedia.group_id.in_(other_group_ids))
                .values(group_id=target_group_id)
            )
            # You might also want to delete the now-empty DuplicateGroup rows

        session.commit()  # Commit this unit of work
