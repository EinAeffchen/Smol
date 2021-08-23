import os
import re
import subprocess
from datetime import datetime
from pathlib import Path
from sys import dont_write_bytecode
from typing import List, Set, Tuple, Union

import cv2
import ffmpeg
from django.conf import settings
from pandas.core.frame import DataFrame
from .detector import get_age_ethnic, recognizer
from .models import Labels, Videos

face_path = Path(settings.MEDIA_ROOT) / "images/faces"
full_face_path = Path(settings.MEDIA_ROOT) / "images/full_faces"
face_path.mkdir(exist_ok=True)
full_face_path.mkdir(exist_ok=True)

VIDEO_SUFFIXES =[".mp4", ".mov", ".wmv", ".avi", ".flv", ".mkv", ".webm", ".gp3", ".ts", ".mpeg"]

def clean_recognize_pkls():
    for pkl_file in face_path.glob("*.pkl"):
        pkl_file.unlink()


def get_videos_containing_actor(video_id: Union[int, Path]) -> Set[str]:
    # clean_recognize_pkls()
    if isinstance(video_id, int):
        faces = [
            str(face_file)
            for face_file in face_path.iterdir()
            if str(video_id) == face_file.name.split("_")[0]
        ]
    else:
        faces = [str(video_id)]
    print(f"faces: {faces}")
    if faces:
        video_results = recognizer(faces, face_path)
        if isinstance(video_results, DataFrame) and not video_results.empty:
            matched_videos = set()
            print(video_results)
            for index, row in video_results.iterrows():
                video_id = Path(row["identity"]).name.split("_")[0]
                matched_videos.add(video_id)
            print(matched_videos)
            return matched_videos
    else:
        print("No faces detected for video!")
    return None


def repackage(path: Path) -> Path:
    """Converts a video to mp4 and returns the new file path"""

    print(f"Video {path} not in mp4 format, reformatting...")
    out_path = path.with_name(path.stem + "_new.mp4")
    process = subprocess.Popen(
        [
            "ffmpeg",
            "-loglevel",
            "panic",
            # "-hwaccel",
            # "cuda",
            "-i",
            str(path),
            str(out_path),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    process.wait()
    if out_path.is_file() and out_path.stat().st_size > 100:
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
    try:
        probe = ffmpeg.probe(str(path))
    except:
        print("Couldn't probe video. File probably broken")
        return {}
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
    return video_data


def calculate_padding(width: int, height: int) -> str:
    ratio = width / height
    tgt_height = 380
    tgt_width = int(tgt_height * ratio)
    padding = 582 - tgt_width
    if padding / 2 > 0:
        pad = f",pad=582:390:{padding/2}:0:black"
    else:
        pad = ""
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


def generate_preview(
    video: Videos, frames: int, preview_dir: Path, video_path: Path
) -> Path:
    if frames:
        nth_frame = int(int(frames) / 70)
    else:
        nth_frame = 25
    out_filename = f"{video.id}.jpg"
    out_path = preview_dir / out_filename
    if out_path.is_file():
        return out_filename
    pad = calculate_padding(video.dim_width, video.dim_height)
    if nth_frame > 50:
        nth_frame = 50
    process = subprocess.Popen(
        [
            "ffmpeg",
            # "-hwaccel",
            # "cuda",
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
            f"select=not(mod(n\,{nth_frame})),scale=-1:380:force_original_aspect_ratio=decrease{pad},tile=70x1",
            str(out_path),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    process.wait()
    # process.terminate()
    return out_filename


def generate_thumbnail(video: Videos, thumbnail_dir: Path, video_path: Path) -> Path:
    out_filename = f"{video.id}.jpg"
    out_path = thumbnail_dir / out_filename
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
                # "-hwaccel",
                # "cuda",
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


def add_labels_by_path(video_row: Videos, labels: List[Labels], video_path: Path):
    for part in video_path.parts:
        for label in labels:
            if label.label.lower() in part.lower():
                video_row.labels.add(label)


def add_additional_labels(video_data: dict, video_row: Videos, race: str = None):
    if video_data.dim_height >= 720:
        hd_label = Labels.objects.filter(label="HD").first()
        video_row.labels.add(hd_label)
    if race:
        race_label = Labels.objects.filter(label=race.lower()).first()
        video_row.labels.add(race_label)


def post_process_videos(preview_dir: Path, video: Videos):
    try:
        age, race = get_age_ethnic(video, preview_dir)
        add_additional_labels(video, video, race)
        video.actor_age = age
        video.processed = True
        video.save()
        print(f"Finished processing {video.filename}")
    except cv2.error as e:
        print(f"Couldn't detect age and race due to {e}")
    return {"finished": False, "video": video.filename}


def generate_previews_thumbnails(thumbnail_dir, preview_dir):
    path = Path(__file__).resolve().parent
    video_dir = path / "static/viewer/ext_videos"
    labels = Labels.objects.all()
    for video in video_dir.rglob("*"):
        if video.name == ".gitignore":
            continue
        if video.is_file() and video.suffix in VIDEO_SUFFIXES:
            if video.suffix != ".mp4" and video.name != ".gitignore":
                video = repackage(video)
            if not Videos.objects.filter(path=str(video)):
                last_video = str(video.name)
                video_data = read_video_info(video)
                video_data["size"] = video.stat().st_size
                video_data["path"] = str(video)
                video_data["filename"] = str(video).replace(
                    os.path.commonprefix([str(video_dir), str(video)]), ""
                )
                frames = video_data.pop("frames")
                video_row = Videos(**video_data)
                video_row.processed = False
                video_row.save()
                video_row.thumbnail = generate_thumbnail(
                    video_row, thumbnail_dir, video
                )
                video_row.preview = generate_preview(
                    video_row, frames, preview_dir, video
                )
                add_labels_by_path(video_row, labels, video)
                video_row.save()
                return {"finished": False, "video": last_video}
    return {"finished": True}
