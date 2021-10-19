import os
import re
import subprocess
from datetime import datetime
from pathlib import Path
from sys import dont_write_bytecode
from typing import List, Set, Tuple, Union
from PIL import Image
import ffmpeg
from django.conf import settings
from pandas.core.frame import DataFrame
from .detector import get_age_ethnic, recognizer, get_age_ethnic_image
from .models import Labels, Videos, Images

face_path = Path(settings.MEDIA_ROOT) / "images/faces"
full_face_path = Path(settings.MEDIA_ROOT) / "images/full_faces"
face_path.mkdir(exist_ok=True)
full_face_path.mkdir(exist_ok=True)

VIDEO_SUFFIXES = [
    ".mp4",
    ".mov",
    ".wmv",
    ".avi",
    ".flv",
    ".mkv",
    ".webm",
    ".gp3",
    ".ts",
    ".mpeg",
]
IMAGE_SUFFIXES = [".jpg", ".jpeg", ".png", ".JPG", ".tiff", ".gif", ".bmp"]


def clean_recognize_pkls():
    for pkl_file in face_path.glob("*.pkl"):
        pkl_file.unlink()


def prepare_faces_images(entity) -> list:
    faces = list()
    print(f"transferred: {entity}")
    faces = [
        str(face_file)
        for face_file in face_path.iterdir()
        if "image_" in face_file.name
        and face_file.name.replace("image_", "").replace(".jpg", "") in entity
    ]
    print(f"faces: {faces}")
    return faces


def prepare_faces_videos(entity) -> list:
    faces = list()
    if isinstance(entity, Path):
        faces = [str(entity)]
    elif isinstance(entity, int):
        entity = [str(entity)]
    if not faces:
        faces = [
            str(face_file)
            for face_file in face_path.iterdir()
            if face_file.name.split("_")[0] in entity
        ]
    print(f"faces: {faces}")
    return faces


def get_videos_containing_actor(
    entity: Union[int, list, Path], type: str
) -> Tuple[list, list]:
    # clean_recognize_pkls()
    faces = []
    if entity:
        print(f"transferred: {entity}")
        if type == "videos":
            faces += prepare_faces_videos(entity)
        elif type == "images":
            faces += prepare_faces_images(entity)
    if faces:
        video_results = recognizer(faces, face_path)
        if isinstance(video_results, DataFrame) and not video_results.empty:
            matched_videos = dict()
            matched_images = dict()
            for index, row in video_results.iterrows():
                video_id = Path(row["identity"]).name.split("_")
                if video_id[0] == "image":
                    image_id = int(video_id[1].split(".")[0])
                    matched_images[image_id] = row["Facenet_euclidean_l2"]
                else:
                    video_id = int(video_id[0])
                    if matched_videos.get(video_id) == None:
                        matched_videos[video_id] = row["Facenet_euclidean_l2"]
                    elif row["Facenet_euclidean_l2"] < matched_videos[video_id]:
                        print("Found smaller value")
                        matched_videos[video_id] = row["Facenet_euclidean_l2"]
            matched_videos = {
                k: v
                for k, v in sorted(matched_videos.items(), key=lambda item: item[1])
            }
            matched_images = {
                k: v
                for k, v in sorted(matched_images.items(), key=lambda item: item[1])
            }
            print(f"videos: {matched_videos}")
            print(f"images: {matched_images}")
            return (list(matched_videos), list(matched_images))
        else:
            print("No matches found!")
    else:
        print(f"No faces detected for {type}!")
    return ([], [])


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


def read_image_info(path: Path):
    print(f"Processing: {path}")
    img = Image.open(str(path))

    image_data = dict()
    image_data["dim_height"], image_data["dim_width"] = img.size
    image_data["processed"] = False
    image_data["size"] = path.stat().st_size
    image_data["path"] = str(path)
    return image_data


def read_video_info(path: Path) -> dict:
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
    except TypeError:
        video_data["duration"] = 0
    return video_data


def calculate_padding(width: int, height: int) -> str:
    tgt_width = 65500 / 50  # (max dim / frames)
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


def generate_preview(
    video: Videos, frames: int, preview_dir: Path, video_path: Path
) -> Path:
    if frames:
        nth_frame = int(int(frames) / 50)
    else:
        nth_frame = 50
    out_filename = f"{video.id}.jpg"
    out_path = preview_dir / out_filename
    if out_path.is_file():
        return out_filename
    pad = calculate_padding(video.dim_width, video.dim_height)
    if nth_frame > 100:
        nth_frame = 100
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
            f"select=not(mod(n\,{nth_frame})),{pad},tile=50x1",
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
    except:
        print(f"Couldn't detect age and race due to {e}")
    return {"finished": False, "file": video.filename, "type": "video"}


def post_process_images(image: Images):
    try:
        age, race = get_age_ethnic_image(image)
        add_additional_labels(image, image, race)
        image.actor_age = age
        image.processed = True
        image.save()
        print(f"Finished processing {image.filename}")
    except:
        print(f"Couldn't detect age and race due to {e}")
    return {"finished": False, "file": image.filename, "type": "image"}


def generate_for_videos(
    file_dir: Path, thumbnail_dir: Path, preview_dir: Path, labels: Labels
):
    for video in file_dir.rglob("*"):
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
                    os.path.commonprefix([str(file_dir), str(video)]), ""
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
                return {"finished": False, "file": last_video, "type": "video"}


def generate_for_images(file_dir: Path, labels: Labels):
    for image in file_dir.rglob("*"):
        if image.name == ".gitignore":
            continue
        if image.is_file() and image.suffix in IMAGE_SUFFIXES:
            if not Images.objects.filter(path=str(image)):
                image_data = read_image_info(image)
                image_data["filename"] = str(image).replace(
                    os.path.commonprefix([str(file_dir), str(image)]), ""
                )
                image_row = Images(**image_data)
                image_row.save()
                add_labels_by_path(image_row, labels, image)
                image_row.save()


labels = Labels.objects.all()


def generate_previews_thumbnails(thumbnail_dir, preview_dir):
    path = Path(__file__).resolve().parent
    file_dir = path / "static/viewer/ext_videos"
    result = generate_for_videos(file_dir, thumbnail_dir, preview_dir, labels)
    if result:
        return result
    result = generate_for_images(file_dir, labels)
    if result:
        return result
    return {"finished": True}
