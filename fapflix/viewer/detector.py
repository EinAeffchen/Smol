import tempfile
import time
from pathlib import Path

import cv2
import numpy as np
from deepface import DeepFace
from django.conf import settings
from typing import Dict, List
from .utils import split_image
from pandas import DataFrame
import pandas as pd

face_path = Path(__file__).parent.parent / "media/images/faces"


def average(lst):
    return sum(lst) / len(lst)


def most_common(lst):
    return max(lst, key=lst.count)


def recognizer(image_files: List[str], face_path: Path) -> DataFrame:
    try:
        result = DeepFace.find(
            image_files,
            str(face_path),
            model_name="Facenet512",
            distance_metric="euclidean_l2",
            enforce_detection=True,
            detector_backend="ssd",
            prog_bar=False,
        )
        if isinstance(result, list):
            result = pd.concat(result)
        # print(result)
        result = result[result["Facenet512_euclidean_l2"] < 0.4]
        print(result)
        return result
    except (ValueError, AttributeError):
        pass


def get_age_ethnic(image_file: Path, debug=False):
    print(image_file)
    images = split_image(image_file, 50)
    ages = []
    age = None
    ethnicities = []
    ethnicity = None
    start = time.time()
    with tempfile.TemporaryDirectory() as tmp_dir_name:
        for i, image in enumerate(images):
            image_path = Path(tmp_dir_name) / "tmp_file.jpg"
            image.save(image_path)
            try:
                result = DeepFace.analyze(
                    img_path=str(image_path),
                    actions=["age", "race"],
                    enforce_detection=True,
                    detector_backend="ssd",
                    prog_bar=False,
                )
                filename = image_file.stem
                image.save(face_path / f"{filename}_{i}.jpg")
                if debug:
                    open_cv_image = cv2.imread(str(image_path))
                    open_cv_image = open_cv_image[:, :, ::-1].copy()
                    print(result)
                    cv2.rectangle(
                        open_cv_image,
                        (result["region"]["x"], result["region"]["y"]),
                        (
                            result["region"]["x"] + result["region"]["w"],
                            result["region"]["y"] + result["region"]["h"],
                        ),
                        (0, 250, 0),
                        3,
                    )
                    cv2.imshow("image", open_cv_image)
                    cv2.waitKey(0)
                ages.append(result["age"])
                ethnicities.append(result["dominant_race"])
            except ValueError:
                pass
        if ages:
            age = average(ages)
        if ethnicities:
            ethnicity = most_common(ethnicities)
        print(age, ethnicity)
        print(f"duration: {time.time()-start}")
        return age, ethnicity


# path = Path(__file__).parent / "static/viewer/images/previews"
# with tempfile.TemporaryDirectory() as tmp_dir_name:
#     for image_file in path.iterdir():
#         if image_file.suffix in [".png"]:
#             get_age_ethnic(image_file, True)
# a = recognizer("/home/einaeffchen/projects/Fapflix2.0/fapflix/media/images/faces/63145_720p/63145_720p_18.png")
# print(a) a.identity = filename, a["VGG-Face_euclidean_l2"] = percent value
