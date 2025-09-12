import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_logger():
    logging.getLogger("PIL.PngImagePlugin").setLevel(logging.CRITICAL + 1)
    logging.getLogger("PIL.TiffImagePlugin").setLevel(logging.CRITICAL + 1)
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    if not logger.handlers:
        ch = logging.StreamHandler()
        ch.setLevel(logging.DEBUG)

        # give it a formatter that shows file and line
        fmt = "%(asctime)s %(name)s %(levelname)s [%(filename)s:%(lineno)d] %(message)s"
        ch.setFormatter(logging.Formatter(fmt))

        logger.addHandler(ch)
        logger.info("Logger setup!")
    return logger


logger = setup_logger()


def configure_file_logging(
    log_dir,
    filename: str = "smol.log",
    max_bytes: int = 5 * 1024 * 1024,
    backup_count: int = 5,
):
    """Add a rotating file handler for persistent logs.

    - log_dir: directory to place the log file in
    - filename: log file name (default: smol.log)
    - max_bytes: rotate after this many bytes
    - backup_count: number of rotated files to keep

    Safe to call multiple times; it won't add duplicates for the same path.
    """
    try:
        log_dir_path = Path(log_dir)
        log_dir_path.mkdir(parents=True, exist_ok=True)
        log_file = (log_dir_path / filename).resolve()

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
                os.fspath(log_file), maxBytes=max_bytes, backupCount=backup_count, encoding="utf-8"
            )
            fh.setLevel(logging.DEBUG)
            fh.setFormatter(logging.Formatter(fmt))
            logger.addHandler(fh)
            # Helpful breadcrumb for new log files
            logger.info("File logging enabled at: %s", log_file)

        return os.fspath(log_file)
    except Exception:
        # Do not fail app startup on logging issues.
        return None
