import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_logger() -> logging.Logger:
    """Configure the shared application logger.

    - Routes console logs to stdout (handy for systemd / Docker capturing stdout only).
    - Keeps propagation disabled so FastAPI/uvicorn don't duplicate messages.
    """

    logging.getLogger("PIL.PngImagePlugin").setLevel(logging.CRITICAL + 1)
    logging.getLogger("PIL.TiffImagePlugin").setLevel(logging.CRITICAL + 1)

    logger = logging.getLogger("app")
    logger.setLevel(logging.DEBUG)
    logger.propagate = False

    # Replace any stale handlers (reloads, multiprocessing forks, etc.)
    for handler in list(logger.handlers):
        logger.removeHandler(handler)

    fmt = "%(asctime)s %(name)s %(levelname)s [%(filename)s:%(lineno)d] %(message)s"
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setLevel(logging.DEBUG)
    stream_handler.setFormatter(logging.Formatter(fmt))
    logger.addHandler(stream_handler)

    logger.info("Application logger initialised")
    return logger


logger = setup_logger()


def configure_file_logging(
    log_dir,
    filename: str = "omoide.log",
    max_bytes: int = 5 * 1024 * 1024,
    backup_count: int = 5,
):
    """Add a rotating file handler for persistent logs.

    - log_dir: directory to place the log file in
    - filename: log file name (default: omoide.log)
    - max_bytes: rotate after this many bytes
    - backup_count: number of rotated files to keep

    Safe to call multiple times; it won't add duplicates for the same path.
    """
    try:
        log_dir_path = Path(log_dir)
        log_dir_path.mkdir(parents=True, exist_ok=True)
        log_file = (log_dir_path / filename).resolve()

        # Remove stale file handlers pointing to different log files
        for handler in list(logger.handlers):
            if isinstance(handler, RotatingFileHandler):
                try:
                    existing = Path(getattr(handler, "baseFilename", "")).resolve()
                except Exception:
                    existing = None
                if existing and existing != log_file:
                    logger.removeHandler(handler)
                    try:
                        handler.close()
                    except Exception:
                        pass

        # Check if a handler for this exact file already exists
        def _has_handler(lg: logging.Logger) -> bool:
            for h in lg.handlers:
                if isinstance(h, RotatingFileHandler):
                    try:
                        if Path(getattr(h, "baseFilename", "")).resolve() == log_file:
                            return True
                    except Exception:
                        continue
            return False

        if not _has_handler(logger):
            fmt = "%(asctime)s %(name)s %(levelname)s [%(filename)s:%(lineno)d] %(message)s"
            fh = RotatingFileHandler(
                os.fspath(log_file),
                maxBytes=max_bytes,
                backupCount=backup_count,
                encoding="utf-8",
            )
            fh.setLevel(logging.DEBUG)
            fh.setFormatter(logging.Formatter(fmt))
            logger.addHandler(fh)
            logger.info("File logging enabled at: %s", log_file)

        return os.fspath(log_file)
    except Exception:
        # Do not fail app startup on logging issues.
        return None
