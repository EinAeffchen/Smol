import tempfile
import time
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd
from deepface import DeepFace
from deepface.commons import functions
from django.conf import settings
from pandas import DataFrame
from PIL import Image

from .models import Images, Videos
from .utils import base64_encode, split_image

face_path = Path(__file__).parent.parent / "media/images/faces"
full_face_path = Path(__file__).parent.parent / "media/images/full_faces"
full_face_path.mkdir(exist_ok=True)
model = DeepFace.build_model("Facenet")


def average(lst):
    return sum(lst) / len(lst)


def most_common(lst):
    return max(lst, key=lst.count)


def recognizer(image_files: List[str], face_path: Path) -> DataFrame:
    result = DeepFace.find(
        image_files,
        str(face_path),
        model_name="Facenet",
        model=model,
        distance_metric="euclidean_l2",
        enforce_detection=True,
        detector_backend="skip",
        prog_bar=False,
        normalization="Facenet"
    )
    if isinstance(result, list):
        result = pd.concat(result).sort_values(by=["Facenet_euclidean_l2"])
    result["identity"] = result["identity"].apply(
        lambda x: x.split("_")[0] if not "image_" in x else x
    )
    print(f"Immediate results: {result[:50]}")
    result = result[result["Facenet_euclidean_l2"] < 0.55]  # 1.02
    return result

def get_age_ethnic_image(image: Images):
    try:
        result = DeepFace.analyze(
            img_path=str(image.path),
            actions=["age", "race"],
            enforce_detection=True,
            detector_backend="ssd",
            prog_bar=False,
        )
        img = Image.open(image.path)
        cropped_image = img.crop(
            (
                result["region"]["x"],
                result["region"]["y"],
                result["region"]["x"] + result["region"]["w"],
                result["region"]["y"] + result["region"]["h"],
            )
        )
        height, width = cropped_image.size
        ratio = height/width
        width = 700*ratio
        cropped_image = cropped_image.resize((700, int(width)), Image.BILINEAR)
        if cropped_image.size[0] > 60 and cropped_image.size[1] > 60:
            try:
                img.save(full_face_path / f"image_{image.id}_face.jpg")
            except OSError:
                rgb_im = img.convert("RGB")
                cropped_image = cropped_image.convert("RGB")
                rgb_im.save(full_face_path / f"image_{image.id}_face.jpg")
            face_image_path = face_path / f"image_{image.id}.jpg"
            cropped_image.save(face_image_path)
        return (result["age"], result["dominant_race"])
    except (ValueError, AttributeError) as e:
        print(e)
        return (None, None)


def get_age_ethnic(video: Videos, video_preview: Path, debug=False):
    images = split_image(video_preview / video.preview, 50)
    ages = []
    ethnicities = []
    face_counter = 0
    saved_full_face = False
    for i, image in enumerate(images):
        if face_counter > 6:
            break
        result = dict()
        face_image_path = face_path / f"{video.id}_{i}.jpg"
        image.save(face_image_path)
        start = time.time()
        try:
            result = DeepFace.analyze(
                img_path=str(face_image_path),
                actions=["age", "race"],
                enforce_detection=True,
                detector_backend="ssd",
                prog_bar=False,
            )
            print(time.time() - start)
            if face_counter <= 6:
                cropped_image = image.crop(
                    (
                        result["region"]["x"],
                        result["region"]["y"],
                        result["region"]["x"] + result["region"]["w"],
                        result["region"]["y"] + result["region"]["h"],
                    )
                )
                height, width = cropped_image.size
                ratio = height/width
                width = 700*ratio
                cropped_image = cropped_image.resize((700, int(width)), Image.BILINEAR)
                if not saved_full_face:
                    image.save(full_face_path / f"{video.id}_face.jpg")
                    saved_full_face = True
                cropped_image.save(face_image_path)
                face_counter += 1

            ages.append(result["age"])
            ethnicities.append(result["dominant_race"])
        except ValueError as e:
            print(e)
            print(time.time() - start)
            if debug:
                show_image_facebox(face_image_path, result)
            face_image_path.unlink()
        except AttributeError as e:
            print(e)
            print("Filename could be problematic, rename video.")
            print(time.time() - start)
            print(result)
    if ages:
        age = min(ages)
    else:
        age = None
    if ethnicities:
        ethnicity = most_common(ethnicities)
    else:
        ethnicity = None
    print(age, ethnicity)
    return age, ethnicity


# path = Path(__file__).parent / "static/viewer/images/previews"
# with tempfile.TemporaryDirectory() as tmp_dir_name:
#     for image_file in path.iterdir():
#         if image_file.suffix in [".png"]:
#             get_age_ethnic(image_file, True)
# a = recognizer("/home/einaeffchen/projects/Fapflix2.0/fapflix/media/images/faces/63145_720p/63145_720p_18.png")
# print(a) a.identity = filename, a["VGG-Face_euclidean_l2"] = percent value
