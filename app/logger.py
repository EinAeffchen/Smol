import logging


def setup_logger():
    logging.getLogger("PIL.PngImagePlugin").setLevel(logging.CRITICAL + 1)
    logging.getLogger("PIL.TiffImagePlugin").setLevel(logging.CRITICAL + 1)

    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
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
