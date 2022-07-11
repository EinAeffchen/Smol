import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import List
from PIL import Image as PILImage
import ffmpeg
from django.conf import settings

from .models import Label, Video, Image


def get_duration(stream: dict):
    duration = stream.get("duration")  # mp4
    if not duration and stream.get("tags"):
        duration = stream.get("tags", {}).get("DURATION-eng")  # mkv
        if not duration:
            duration = stream.get("tags", {}).get("DURATION")  # webm
    return duration


def read_image_info(path: Path):
    img = PILImage.open(str(path))

    image_data = dict()
    image_data["dim_height"], image_data["dim_width"] = img.size
    image_data["size"] = path.stat().st_size
    image_data["path"] = str(path)
    return image_data


def read_video_info(path: Path) -> dict:
    probe = ffmpeg.probe(str(path))

    video_stream = next(
        (
            stream
            for stream in probe["streams"]
            if stream["codec_type"] == "video"
        ),
        None,
    )
    audio_stream = next(
        (
            stream
            for stream in probe["streams"]
            if stream["codec_type"] == "audio"
        ),
        None,
    )
    video_data = dict()
    video_data["dim_height"] = video_stream["height"]
    video_data["dim_width"] = video_stream["width"]
    video_data["videocodec"] = video_stream["codec_name"]
    if audio_stream:
        video_data["audiocodec"] = audio_stream["codec_name"]
    video_data["duration"] = get_duration(video_stream)
    video_data["bitrate"] = video_stream.get("bit_rate")
    video_data["frames"] = video_stream.get(
        "nb_frames", video_stream.get("tags", {}).get("NUMBER_OF_FRAMES-eng")
    )
    try:
        video_data["duration"] = float(video_data["duration"])
    except ValueError:
        time = video_data["duration"].split(".")[0]
        dur = datetime.strptime(time, "%H:%M:%S") - datetime(1900, 1, 1)
        video_data["duration"] = dur.total_seconds()
    except TypeError:
        video_data["duration"] = 0
    return video_data


def calculate_padding(width: int, height: int) -> str:
    tgt_width = 410  # (max dim / frames)
    tgt_height = tgt_width / 1.51
    height_padding = 0
    # scale to target height
    diff = height / tgt_height
    width = width / diff
    if width > tgt_width:
        diff = width / tgt_width
        width = tgt_width
        tgt_height_new = tgt_height / diff
        height_padding = int((tgt_height - tgt_height_new))
        tgt_height = tgt_height_new

    padding = tgt_width - width

    if padding < 0:
        pad = f"scale={int(width)-10}:{int(tgt_height)-10}:force_original_aspect_ratio=decrease,pad={int(tgt_width)}:{int(tgt_height)+height_padding}:10:{int(height_padding/2)}:black"
    else:
        pad = f"scale={int(width)}:{int(tgt_height)-10}:force_original_aspect_ratio=decrease,pad={int(tgt_width)}:{int(tgt_height)+height_padding}:{int(padding/2)}:{int(height_padding/2)}:black"
    return pad


def update_preview_name(filename: str, preview_dir: Path):
    counter = 1
    out_filename = f"{filename}_{counter}.jpg"
    out_path = preview_dir / out_filename
    while out_path.is_file():
        counter += 1
        out_filename = f"{filename}_{counter}.jpg"
        out_path = preview_dir / out_filename
    return out_path, out_filename


def generate_preview(video: Video, frames: int, video_path: Path) -> str:
    if frames:
        nth_frame = int(int(frames) / settings.PREVIEW_IMAGES)
    else:
        nth_frame = settings.PREVIEW_IMAGES
    out_filename = f"{video.id}.jpg"
    out_path = settings.PREVIEW_DIR / out_filename
    if out_path.is_file():
        return out_filename
    pad = calculate_padding(video.dim_width, video.dim_height)
    if nth_frame > 100:
        nth_frame = 100
    process = subprocess.Popen(
        [
            "ffmpeg",
            "-loglevel",
            "panic",
            "-y",
            "-i",
            str(video_path),
            "-frames",
            "1",
            "-q:v",
            "5",
            "-c:v",
            "mjpeg",
            "-vf",
            f"select=not(mod(n\,{nth_frame})),{pad},tile={settings.PREVIEW_IMAGES}x1",
            str(out_path),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    process.wait()
    # process.terminate()
    return out_filename


def generate_thumbnail(video: Video, video_path: Path) -> str:
    out_filename = f"{video.id}.jpg"
    out_path = settings.THUMBNAIL_DIR / out_filename
    if out_path.is_file():
        return out_filename
    if not out_path.is_file():
        if video.duration:
            thumbnail_ss = int(video.duration / 2)
        else:
            thumbnail_ss = 5
        process = subprocess.Popen(
            [
                "ffmpeg",
                "-ss",
                str(thumbnail_ss),
                "-loglevel",
                "panic",
                "-y",
                "-i",
                str(video_path),
                "-frames",
                "1",
                "-q:v",
                "0",
                "-an",
                "-c:v",
                "mjpeg",
                "-vf",
                "scale=-2:380:force_original_aspect_ratio=increase",
                str(out_path),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        process.wait()
    return out_filename


def add_labels_by_path(video_row: Video, video_path: Path):
    for part in video_path.parts[5:-1]:
        label_candidates = part.lower()
        for label_candidate in label_candidates.split():
            try:
                label = Label.objects.get(label=label_candidate)
            except Label.DoesNotExist:
                label = Label.objects.create(label=label_candidate)
            video_row.labels.add(label)


def generate_for_videos():
    start = datetime.now()
    for suffix in settings.VIDEO_SUFFIXES:
        for video in settings.MEDIA_DIR.rglob(f"*{suffix}"):
            find_time = datetime.now()
            if not Video.objects.filter(path=str(video)):
                db_check = datetime.now()
                video_data = read_video_info(video)
                video_info = datetime.now()
                video_data["size"] = video.stat().st_size
                video_data["path"] = str(video)
                video_data["filename"] = video.name
                frames = video_data.pop("frames")
                video_row = Video(**video_data)
                video_row.processed = False
                video_row.save()
                tn = datetime.now()
                video_row.thumbnail = generate_thumbnail(video_row, video)
                a_tn = datetime.now()
                video_row.preview = generate_preview(video_row, frames, video)
                a_pv = datetime.now()
                add_labels_by_path(video_row, video)
                video_row.save()
                return {"finished": False, "file": video.name, "type": "video"}


def generate_for_images():
    for suffix in settings.IMAGE_SUFFIXES:
        for image in settings.MEDIA_DIR.rglob(f"*{suffix}"):
            if ".smol" not in image.parts and not Image.objects.filter(
                path=str(image)
            ):
                image_data = read_image_info(image)
                image_data["filename"] = image.name
                image_row = Image(**image_data)
                image_row.save()
                add_labels_by_path(image_row, image)
                image_row.save()
                return {"finished": False, "file": image.name, "type": "image"}


def generate_previews_thumbnails():
    result = generate_for_videos()
    if result:
        return result
    result = generate_for_images()
    if result:
        return result
    return {"finished": True}
