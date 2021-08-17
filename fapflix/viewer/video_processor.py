import os
import re
import subprocess
from datetime import datetime
from operator import sub
from pathlib import Path
from sys import dont_write_bytecode
from typing import List, Set, Tuple

import cv2
import ffmpeg
import pandas as pd
from django.conf import settings
from pandas.core.frame import DataFrame

from .detector import get_age_ethnic, recognizer
from .models import Labels, Videos

face_path = Path(settings.MEDIA_ROOT) / "images/faces"
face_path.mkdir(exist_ok=True)


def clean_recognize_pkls():
    for pkl_file in face_path.glob("*.pkl"):
        pkl_file.unlink()


def get_videos_containing_actor(filename: str) -> Tuple[Set[str], str]:
    clean_recognize_pkls()
    filename_stem = filename.split(".")[0]
    faces = [
        str(face_file)
        for face_file in face_path.iterdir()
        if filename_stem in str(face_file)
    ]
    video_results = recognizer(faces, face_path)
    if isinstance(video_results, DataFrame) and not video_results.empty:
        matched_videos = set()
        print(video_results)
        face = video_results.iloc[0]["identity"]
        for index, row in video_results.iterrows():
            video = re.sub("_\d+\.jpg", ".jpg", Path(row["identity"]).name)
            matched_videos.add(video)
        print(matched_videos)
        return matched_videos, face
    return None, None

def repackage(path: Path):
    print(f"Missing video info for {path}. Trying to repackage...")
    out_path = path.with_name(path.stem + "_new.mp4")
    process = subprocess.Popen(
        [
            "ffmpeg",
            "-hwaccel",
            "cuda",
            "-loglevel",
            "panic",
            "-i",
            str(path),
            "-c:a",
            "copy",
            str(out_path),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    process.wait()
    if out_path.is_file():
        path.unlink()
    else:
        return False
    return out_path


def get_duration(stream: dict):
    duration = stream.get("duration")  # mp4
    if not duration and stream.get("tags"):
        duration = stream.get("tags", {}).get("DURATION-eng")  # mkv
        if not duration:
            duration = stream.get("tags", {}).get("DURATION")  # webm
    return duration


def read_video_info(path: Path) -> dont_write_bytecode:
    print(f"Processing: {path}")
    probe = ffmpeg.probe(str(path))
    video_stream = next(
        (stream for stream in probe["streams"] if stream["codec_type"] == "video"), None
    )
    audio_stream = next(
        (stream for stream in probe["streams"] if stream["codec_type"] == "audio"), None
    )
    video_data = dict()
    video_data["dim_height"] = video_stream["height"]
    video_data["dim_width"] = video_stream["width"]
    video_data["videocodec"] = video_stream["codec_name"]
    video_data["audiocodec"] = audio_stream["codec_name"]
    video_data["duration"] = get_duration(video_stream)
    if not video_data["duration"] and not "_new" in path.stem:
        new_path = repackage(path)
        if new_path:
            return read_video_info(new_path)
        else:
            print("Couldn't fix metadata")
    video_data["filepath"] = path
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
    return video_data


def calculate_distance(width: int, height: int) -> int:
    ratio = width / height
    tgt_height = 380
    tgt_width = int(tgt_height * ratio)
    padding = 582 - tgt_width
    if padding < 0:
        return 0
    return padding / 2

def update_preview_name(filename: str, preview_dir: Path):
    counter = 1
    out_filename = f"{filename}_{counter}.jpg"
    out_path = preview_dir / out_filename
    while out_path.is_file():
        counter += 1
        out_filename = f"{filename}_{counter}.jpg"
        out_path = preview_dir / out_filename
    return out_path, out_filename

def generate_preview(path: Path, frames: int, preview_dir: Path, width, height) -> Path:
    nth_frame = int(int(frames) / 50)
    out_filename = f"{path.stem}.jpg"
    out_path = preview_dir / out_filename
    if out_path.is_file():
        out_path, out_filename = update_preview_name(path.stem, preview_dir)
    dist = calculate_distance(width, height)
    if nth_frame > 25:
        nth_frame = 25
    if dist > 0:
        pad = f",pad=582:390:{dist}:0:black"
    else:
        pad = ""
    process = subprocess.Popen(
        [
            "ffmpeg",
            "-hwaccel",
            "cuda",
            "-loglevel",
            "panic",
            "-y",
            "-i",
            str(path),
            "-frames",
            "1",
            "-q:v",
            "5",
            "-c:v",
            "mjpeg",
            "-vf",
            f"select=not(mod(n\,{nth_frame})),scale=-1:380:force_original_aspect_ratio=decrease{pad},tile=50x1",
            str(out_path),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    process.wait()
    # process.terminate()
    return out_filename


def generate_thumbnail(video: Path, thumbnail_dir: Path, vid_duration: int) -> Path:
    out_filename = f"{video.stem}.jpg"
    out_path = thumbnail_dir / out_filename
    if out_path.is_file():
        out_path, out_filename = update_preview_name(video.stem, thumbnail_dir)
    if not out_path.is_file():
        if vid_duration:
            thumbnail_ss = int(vid_duration / 2)
        else:
            thumbnail_ss = 5
        process = subprocess.Popen(
            [
                "ffmpeg",
                "-ss",
                str(thumbnail_ss),
                "-hwaccel",
                "cuda",
                "-loglevel",
                "panic",
                "-y",
                "-i",
                str(video),
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


def add_labels_by_path(video_row: Videos, labels: List[Labels], video_path: Path):
    for part in video_path.parts:
        for label in labels:
            if label.label.lower() in part.lower():
                video_row.labels.add(label)


def add_additional_labels(video_data: dict, video_row: Videos, race: str = None):
    if video_data["dim_height"] >= 720:
        hd_label = Labels.objects.filter(label="HD").first()
        video_row.labels.add(hd_label)
    if race:
        race_label = Labels.objects.filter(label=race.lower()).first()
        video_row.labels.add(race_label)


def process_videos(thumbnail_dir, preview_dir):
    path = Path(__file__).resolve().parent
    video_dir = path / "static/viewer/ext_videos"
    labels = Labels.objects.all()
    for video in video_dir.rglob("*"):
        if video.is_file() and video.suffix in [
            ".mp4",
            ".mov",
            ".mkv",
            ".flv",
            ".f4v",
            ".wmv",
            ".avi",
            ".webm",
        ]:
            if not Videos.objects.filter(path=str(video)):
                last_video = str(video.name)
                video_data = read_video_info(video)
                video = Path(video_data.pop("filepath"))
                video_data["size"] = video.stat().st_size
                video_data["path"] = str(video)
                video_data["filename"] = str(video).replace(
                    os.path.commonprefix([str(video_dir), str(video)]), ""
                )
                frames = video_data.pop("frames")
                video_row = Videos(**video_data)
                video_row.thumbnail = generate_thumbnail(
                    video, thumbnail_dir, video_data["duration"]
                )
                video_row.preview = generate_preview(
                    video,
                    frames,
                    preview_dir,
                    video_data["dim_width"],
                    video_data["dim_height"],
                )
                video_row.processed = True
                video_row.save()
                try:
                    age, race = get_age_ethnic(preview_dir / video_row.preview)
                    add_additional_labels(video_data, video_row, race)
                    video_row.actor_age = age
                except cv2.error as e:
                    print("Couldn't detect age and race due to {e}")
                add_labels_by_path(video_row, labels, video)
                video_row.save()
                return {"finished": False, "video": last_video}
    return {"finished": True}
