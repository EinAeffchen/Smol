from operator import sub
from pathlib import Path
from django.conf import settings
from sys import dont_write_bytecode
import ffmpeg
from .models import Videos, Labels
import subprocess
from datetime import datetime
from typing import List
import os


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


def generate_preview(path: Path, frames: int, preview_dir: Path) -> Path:
    nth_frame = int(int(frames) / 100)
    out_filename = f"{path.stem}.png"
    out_path = preview_dir / out_filename
    if not out_path.is_file():
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
                f"select=not(mod(n\,{nth_frame})),scale=-1:240,tile=100x1",
                str(out_path),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        process.wait()
        # process.terminate()
    return out_filename


def generate_thumbnail(
    video: Path, width: int, thumbnail_dir: Path, vid_duration: int
) -> Path:
    out_filename = f"{video.stem}.png"
    out_path = thumbnail_dir / out_filename
    if not out_path.is_file():
        if vid_duration:
            thumbnail_ss = int(vid_duration / 2)
        else:
            thumbnail_ss = 5
        print(f"ss: {thumbnail_ss}")
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
                "5",
                "-an",
                "-c:v",
                "mjpeg",
                "-vf",
                "scale=-1:240",
                str(out_path),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        process.wait()
        ffmpeg.input(video, ss=20).filter("scale", width, -1).output(
            out_path, vframes=1
        ).overwrite_output().run(capture_stdout=True, capture_stderr=True)
    return out_filename


def add_labels(video_row: Videos, labels: List[Labels], video_path: Path):
    for part in video_path.parts:
        for label in labels:
            if label.label.lower() in part.lower():
                video_row.labels.add(label)


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
                last_video = str(video.parts[-1])
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
                    video, 480, thumbnail_dir, video_data["duration"]
                )
                video_row.preview = generate_preview(video, frames, preview_dir)
                video_row.processed = True
                video_row.save()
                add_labels(video_row, labels, video)
                video_row.save()
                return {"finished": False, "video": last_video}
            else:
                print(f"{video} already in db!")
    return {"finished": True}
