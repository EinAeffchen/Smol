# app/processors/exif.py
from pathlib import Path
from datetime import datetime
from PIL import ExifTags
from sqlmodel import select
from app.processors.base import MediaProcessor
from app.models import Media, ExifData, Scene
from app.config import VIDEO_SUFFIXES, MEDIA_DIR
from cv2.typing import MatLike
from PIL.MpoImagePlugin import MpoImageFile
from app.database import safe_commit
from sqlalchemy.orm import Session
import ffmpeg
from dateutil import parser
from app.logger import logger
import traceback


def _decode_bytes(val: bytes) -> str:
    try:
        return val.rstrip(b"\x00").decode("utf-8", "ignore")
    except Exception as e:
        logger.error("FAILED DECODING BYTES: %s", e)
        return val.decode("latin1", "ignore")


def _to_decimal(coord, ref):
    # coord: tuple of 3 rationals or floats, ref: 'N','S','E','W'
    d, m, s = coord
    dec = float(d) + float(m) / 60 + float(s) / 3600
    return dec if ref in ("N", "E") else -dec


class ExifProcessor(MediaProcessor):
    name = "exif"

    def _process_image(
        self, img: MpoImageFile, session: Session, media: Media
    ):
        try:
            raw = img._getexif() or {}

            # 3) map tag IDs → names and decode byte‑strings
            exif = {}
            for tag_id, val in raw.items():
                tag = ExifTags.TAGS.get(tag_id, tag_id)
                if isinstance(val, bytes):
                    val = _decode_bytes(val)
                exif[tag] = val

            # 4) pull out fields
            make = exif.get("Make")
            model = exif.get("Model")
            dt = exif.get("DateTimeOriginal") or exif.get("DateTime")
            timestamp = (
                datetime.strptime(dt, "%Y:%m:%d %H:%M:%S") if dt else None
            )

            iso = exif.get("ISOSpeedRatings")
            exp = exif.get("ExposureTime")  # might be a Fraction
            exposure_time = str(exp) if exp else None

            fnum = exif.get("FNumber")
            aperture = f"F{float(fnum):.1f}" if fnum else None

            foc35 = exif.get("FocalLengthIn35mmFilm")
            focal_length = float(foc35) if foc35 else None

            # 5) decode GPSInfo sub‑tags
            gps = raw.get(ExifTags.GPSTAGS and 0x8825) or raw.get(34853) or {}
            lat = lon = None
            if isinstance(gps, dict):
                # keys are ints; map to names
                decoded = {
                    ExifTags.GPSTAGS.get(k, k): v for k, v in gps.items()
                }
                lat_val = decoded.get("GPSLatitude")
                lat_ref = decoded.get("GPSLatitudeRef")
                lon_val = decoded.get("GPSLongitude")
                lon_ref = decoded.get("GPSLongitudeRef")
                if lat_val and lat_ref:
                    lat = _to_decimal(lat_val, lat_ref)
                if lon_val and lon_ref:
                    lon = _to_decimal(lon_val, lon_ref)

            # 6) persist
            rec = ExifData(
                media_id=media.id,
                make=make,
                model=model,
                timestamp=timestamp,
                iso=int(iso) if iso else None,
                exposure_time=exposure_time,
                aperture=aperture,
                focal_length=focal_length,
                lat=lat,
                lon=lon,
            )
            session.add(rec)
            safe_commit(session)

        except Exception as e:
            logger.error("EXIF FAILED: %s", e)
            # on any decode error, skip silently
            pass

    def _process_video(self, media: Media, session: Session):
        logger.debug("EXIF FROM VIDEO")
        try:
            video_meta = ffmpeg.probe(str(MEDIA_DIR / media.path))
            tags = video_meta.get("format", {}).get("tags", {})
            if not tags:
                return

            location_data = tags.get("location", "").strip("+/")
            if location_data:
                lat, lon = location_data.split("+")
            else:
                lat, lon = None, None
            timestamp = tags.get("creation_time")
            if timestamp:
                timestamp = parser.parse(timestamp)
            model = (
                tags.get("com.android.manufacturer", "")
                + tags.get("com.android.model", "").strip()
            )
            if lat and lon:
                try:
                    lat = float(lat)
                    lon = float(lon)
                except ValueError:
                    lat = None
                    lon = None
            # 6) persist
            rec = ExifData(
                media_id=media.id,
                model=model,
                timestamp=timestamp,
                lat=lat,
                lon=lon,
            )
            session.add(rec)
            safe_commit(session)
        except Exception as e:
            logger.error(e)
            logger.error(traceback.format_exc())

    def process(
        self,
        media: Media,
        session,
        scenes: list[tuple[Scene, MatLike] | MpoImageFile],
    ):
        # 1) skip if already extracted
        if session.exec(
            select(ExifData).where(ExifData.media_id == media.id)
        ).first():
            return

        # 2) only on JPEG/TIFF
        fn = Path(media.filename)
        if fn.suffix in ((".jpg", ".jpeg", ".tiff")):
            self._process_image(scenes[0], session, media)
        elif fn.suffix in VIDEO_SUFFIXES:
            self._process_video(media, session)

    def load_model(self):
        """Doesn't need a model"""

    def unload(self):
        """Doesn't need a model"""

    def get_results(self, media_id: int, session):
        return session.exec(
            select(ExifData).where(ExifData.media_id == media_id)
        ).first()
