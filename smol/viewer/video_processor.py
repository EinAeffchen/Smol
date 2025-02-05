import json
import pickle
import subprocess
from datetime import datetime
from hashlib import sha1
from pathlib import Path
from typing import Generator, Optional

import ffmpeg
import pandas as pd
from deepface.modules import verification
from django.conf import settings
from PIL import Image as PILImage
from tqdm import tqdm

from .models import Label, Video, VideoPersonMatch


def get_duration(stream: dict):
    duration = stream.get("duration")  # mp4
    if not duration and stream.get("tags"):
        duration = stream.get("tags", {}).get("DURATION-eng")  # mkv
        if not duration:
            duration = stream.get("tags", {}).get("DURATION")  # webm
    return duration


def read_image_info(path: Path, file_path: Path):
    img = PILImage.open(str(path))

    image_data = dict()
    image_data["dim_height"], image_data["dim_width"] = img.size
    image_data["size"] = path.stat().st_size
    image_data["path"] = file_path
    return image_data


def read_video_info(path: Path) -> dict:
    probe = ffmpeg.probe(str(path))
    probe_str = json.dumps(probe, indent=2, sort_keys=True)
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
    video_data["id_hash"] = sha1(probe_str.encode("utf-8")).hexdigest()
    video_data["dim_height"] = video_stream["height"]
    video_data["dim_width"] = video_stream["width"]
    video_data["videocodec"] = video_stream["codec_name"]
    if audio_stream:
        video_data["audiocodec"] = audio_stream["codec_name"]
    video_data["duration"] = get_duration(video_stream)
    video_data["bitrate"] = video_stream.get("bit_rate")
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
    out_filename = f"{video.filename}-{video.duration}.jpg"
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


def generate_thumbnail(video: "Video", video_path: Path) -> str:
    out_filename = f"{video.id_hash}.jpg"
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


def add_labels_by_path(video: "Video"):
    for part in Path(video.path).parts[:-1]:
        label_candidates = part.lower()
        for label_candidate in label_candidates.split():
            try:
                label = Label.objects.get(label=label_candidate)
            except Label.DoesNotExist:
                label = Label.objects.create(label=label_candidate)
                label.save()
            video.labels.add(label)


def load_embedding_database(video_id: Optional[int] = None):
    representations: Generator[Path, None, None] = (
        settings.RECOGNITION_DATA_PATH.glob("*.pkl")
    )
    datasets = []
    print("Loading recognition db!")
    for rep in representations:
        if video_id and rep.stem == str(video_id):
            continue
        with open(rep, "rb") as f_in:
            faces = pickle.load(f_in)
            datasets += faces
    return pd.DataFrame(datasets)


face_database = load_embedding_database()


class Matcher:
    MATCHING_MODES: dict[int, callable]

    def __init__(self) -> None:
        self.MATCHING_MODES = dict()
        self.MATCHING_MODES[1] = self.matching_mode_1
        self.MATCHING_MODES[2] = self.matching_mode_2

    def start_matching(self, video: Video, mode: int = 1):
        if video.ran_recognition:
            print("Video already got checked for related videos!")
            return
        encodings = video.face_encodings
        if not encodings or len(encodings) == 0:
            return
        if face_database.empty:
            print("No other detection data exists, nothing to match against!")
            return
        return self.MATCHING_MODES[mode](video)

    def matching_mode_2(
        self,
        video: Video,
        distance_metric: str = "cosine",
    ):
        """
        Takes into account all distances between the src_video
        first face and averages the distance to all other faces."""
        matched_videos = dict()
        first_encoding = video.face_encodings[0]
        target_embedding_obj = first_encoding["embedding"]
        matched_videos_tmp: dict[str, list] = dict()
        matched_videos_tmp = self.get_distances(
            video, distance_metric, target_embedding_obj
        )
        for identity, distances in matched_videos_tmp.items():
            matched_videos[identity] = (
                matched_videos.get(identity, 0)
                + sum(distances) / len(distances)
            ) / 2
        for video_id, scores in matched_videos.items():
            if len(scores) / len(encodings) >= 0.4:
                match_count += 1
                distance_score = sum(scores) / len(scores)
                save_match(video, video_id, distance_score)
        video.related_videos.clear()
        match_count = 0

    def matching_mode_1(
        self,
        video: Video,
        distance_metric: str = "cosine",
    ):
        """
        For every detected source face saves all matching values against the target
        faces, if they are below the threshold. If 2/5 of the compared faces match
        it returns a match.
        """
        matched_videos: dict[Video, float] = dict()
        target_threshold = (
            settings.RECOGNITION_THRESHOLD
            or verification.find_threshold(
                settings.RECOGNITION_MODEL, distance_metric
            )
        )
        for encoding in tqdm(video.face_encodings):
            target_representation = encoding["embedding"]
            matched_videos_tmp = self.get_distances(
                video, distance_metric, target_representation
            )

            for identity, distances in matched_videos_tmp.items():
                for distance in distances:
                    if distance <= target_threshold:
                        matched_videos[identity] = matched_videos.get(
                            identity, []
                        ) + [distance]

            video.related_videos.clear()
            match_count = 0
            for video_id, scores in sorted(
                matched_videos.items(), key=lambda x: x[1]
            ):
                if sum(scores) / len(scores) <= target_threshold:
                    match_count += 1
                    distance_score = sum(scores) / len(scores)
                    save_match(video, video_id, distance_score)
            video.ran_recognition = True
            video.save()
        print(f"Saved {match_count} matched videos.")

    def get_distances(self, video, distance_metric, target_representation):
        matched_videos_tmp: dict[str, list] = dict()
        error_counter = 0
        for _, db_instance in tqdm(face_database.iterrows()):
            if str(db_instance["identity"]) == str(video.id_hash):
                continue
            source_representation = db_instance["embedding"]
            if source_representation is None:
                continue
            try:
                distance = verification.find_distance(
                    source_representation,
                    target_representation,
                    distance_metric,
                )
            except ValueError:
                error_counter+=1
            matched_videos_tmp[db_instance.identity] = matched_videos_tmp.get(
                db_instance.identity, []
            ) + [distance]
        return matched_videos_tmp


def recognize_faces(video: Video):
    global face_database
    matcher = Matcher()
    matcher.start_matching(video)


def save_match(video, related_video_id, score):
    related_video = Video.objects.filter(id_hash=related_video_id).first()
    match = VideoPersonMatch(
        source_video=video,
        related_video=related_video,
        score=score,
    )
    match.save()
    match_reverse = VideoPersonMatch(
        source_video=related_video,
        related_video=video,
        score=score,
    )
    match_reverse.save()
