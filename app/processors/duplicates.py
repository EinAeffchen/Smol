from sqlmodel import Session, select, delete, update
import app.database as db
from app.logger import logger
from app.models import (
    Media,
    ProcessingTask,
    DuplicateGroup,
    DuplicateMedia,
    Blacklist,
)
from sqlalchemy import func
from datetime import datetime, timezone
from app.config import settings, DuplicateHandlingRule, DuplicateKeepRule
from app.utils import delete_file, delete_record
import imagehash

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

    def _media_resolution(self, media: Media) -> int:
        width = media.width or 0
        height = media.height or 0
        return int(width) * int(height)

    def _media_timestamp(self, media: Media) -> datetime:
        for candidate in (media.created_at, media.inserted_at):
            if isinstance(candidate, datetime):
                if candidate.tzinfo is not None:
                    return candidate.replace(tzinfo=None)
                return candidate
        return datetime.min

    def _select_master_media(self, media_items: list[Media]) -> Media | None:
        if not media_items:
            return None
        rule = settings.duplicates.duplicate_auto_keep_rule
        if rule == DuplicateKeepRule.BIGGEST:
            return max(
                media_items,
                key=lambda m: ((m.size or 0), m.id),
            )
        if rule == DuplicateKeepRule.SMALLEST:
            return min(
                media_items,
                key=lambda m: ((m.size or 0), m.id),
            )
        if rule == DuplicateKeepRule.HIGHEST_RES:
            return max(
                media_items,
                key=lambda m: (self._media_resolution(m), m.id),
            )
        if rule == DuplicateKeepRule.LOWEST_RES:
            return min(
                media_items,
                key=lambda m: (self._media_resolution(m), m.id),
            )
        if rule == DuplicateKeepRule.NEWEST:
            return max(
                media_items,
                key=lambda m: (self._media_timestamp(m), m.id),
            )
        # Default to OLDEST
        return min(
            media_items,
            key=lambda m: (self._media_timestamp(m), m.id),
        )

    def _apply_duplicate_action(self, session: Session, media: Media) -> None:
        rule = settings.duplicates.duplicate_auto_handling
        if rule is DuplicateHandlingRule.REMOVE:
            logger.info("Auto-removing duplicate record id=%s path=%s", media.id, media.path)
            delete_record(media.id, session)
            return
        if rule is DuplicateHandlingRule.BLACKLIST:
            if media.path:
                existing = session.exec(
                    select(Blacklist).where(Blacklist.path == media.path)
                ).first()
                if not existing:
                    session.add(Blacklist(path=media.path))
            logger.info("Auto-blacklisting duplicate record id=%s path=%s", media.id, media.path)
            delete_record(media.id, session)
            return
        if rule is DuplicateHandlingRule.DELETE:
            logger.info("Auto-deleting duplicate file id=%s path=%s", media.id, media.path)
            delete_file(session, media.id)
            return

    def _auto_resolve_media_items(
        self, session: Session, media_items: list[Media]
    ) -> None:
        if (
            settings.duplicates.duplicate_auto_handling
            is DuplicateHandlingRule.KEEP
        ):
            return
        unique_media = {media.id: media for media in media_items if media is not None}
        if len(unique_media) <= 1:
            return
        master = self._select_master_media(list(unique_media.values()))
        if master is None:
            return
        processed = 0
        for media_id, media in unique_media.items():
            if media_id == master.id:
                continue
            self._apply_duplicate_action(session, media)
            processed += 1
        logger.info(
            "Duplicate auto-handling applied rule=%s (kept id=%s, processed=%s others)",
            settings.duplicates.duplicate_auto_handling.value,
            master.id if master else None,
            processed,
        )

    def _auto_resolve_duplicates_by_ids(
        self, session: Session, media_ids: list[int]
    ) -> None:
        if len(media_ids) <= 1:
            return
        media_items = session.exec(
            select(Media).where(Media.id.in_(media_ids))
        ).all()
        if len(media_items) <= 1:
            return
        self._auto_resolve_media_items(session, media_items)

    def process(self):
        with Session(db.engine) as session:
            self._update_task_status(session, "running")
            logger.info(
                f"Starting pHash duplicate detection task {self.task_id}"
            )

            try:
                # --- Phase 1: Group by IDENTICAL Hashes ---

                # Find all hashes that appear more than once
                stmt = (
                    select(Media.phash, func.count(Media.id).label("count"))
                    .where(
                        Media.phash.is_not(None),
                        func.length(Media.phash) > 0,
                    )
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
                    image_ids = [m.id for m in media_items if m.duration is None]
                    video_ids = [m.id for m in media_items if m.duration is not None]

                    if settings.duplicates.duplicate_auto_handling is DuplicateHandlingRule.KEEP:
                        if len(image_ids) > 1:
                            self._create_or_update_group(session, image_ids)
                        if len(video_ids) > 1:
                            self._create_or_update_group(session, video_ids)
                    else:
                        if len(image_ids) > 1:
                            image_id_set = set(image_ids)
                            image_media = [
                                media
                                for media in media_items
                                if media.id in image_id_set
                            ]
                            self._auto_resolve_media_items(session, image_media)
                        if len(video_ids) > 1:
                            video_id_set = set(video_ids)
                            video_media = [
                                media
                                for media in media_items
                                if media.id in video_id_set
                            ]
                            self._auto_resolve_media_items(session, video_media)


                logger.info(
                    f"Completed grouping {len(duplicate_hashes)} sets of identical media hashes."
                )
                self._update_task_progress_and_check_status(
                    session, 1, 2
                )

                near_duplicate_groups = 0
                if self.threshold and self.threshold > 0:
                    video_stmt = (
                        select(Media.id, Media.phash)
                        .where(
                            Media.duration.is_not(None),
                            Media.phash.is_not(None),
                            func.length(Media.phash) > 0,
                        )
                    )
                    video_candidates = session.exec(video_stmt).all()
                    valid_video_hashes: list[tuple[int, imagehash.ImageHash]] = []
                    for media_id, phash in video_candidates:
                        try:
                            hash_obj = imagehash.hex_to_hash(phash)
                        except (ValueError, TypeError) as exc:
                            logger.debug(
                                "Skipping video %s due to invalid pHash %s: %s",
                                media_id,
                                phash,
                                exc,
                            )
                            continue
                        valid_video_hashes.append((media_id, hash_obj))

                    if len(valid_video_hashes) > 1:
                        uf = UnionFind([media_id for media_id, _ in valid_video_hashes])
                        for idx in range(len(valid_video_hashes)):
                            media_a, hash_a = valid_video_hashes[idx]
                            for jdx in range(idx + 1, len(valid_video_hashes)):
                                media_b, hash_b = valid_video_hashes[jdx]
                                try:
                                    distance = hash_a - hash_b
                                except Exception as exc:
                                    logger.debug(
                                        "Failed to compare hashes for %s and %s: %s",
                                        media_a,
                                        media_b,
                                        exc,
                                    )
                                    continue
                                if distance <= self.threshold:
                                    uf.union(media_a, media_b)

                        cluster_map: dict[int, list[int]] = {}
                        for media_id, _ in valid_video_hashes:
                            root = uf.find(media_id)
                            cluster_map.setdefault(root, []).append(media_id)

                        for group_media_ids in cluster_map.values():
                            if len(group_media_ids) < 2:
                                continue
                            if (
                                settings.duplicates.duplicate_auto_handling
                                is DuplicateHandlingRule.KEEP
                            ):
                                self._create_or_update_group(
                                    session, group_media_ids
                                )
                            else:
                                self._auto_resolve_duplicates_by_ids(
                                    session, group_media_ids
                                )
                            near_duplicate_groups += 1

                logger.info(
                    "Identified %d near-duplicate video groups using threshold %d",
                    near_duplicate_groups,
                    self.threshold,
                )
                self._update_task_progress_and_check_status(
                    session, 2, 2
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
