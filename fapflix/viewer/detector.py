import tempfile
from pathlib import Path

import numpy as np
from deepface import DeepFace
import cv2
from .utils import split_image
import time

def average(lst):
    return sum(lst) / len(lst)


def most_common(lst):
    return max(lst, key=lst.count)

def get_age_ethnic(image_file: Path, debug=False):
    print(image_file)
    images = split_image(image_file, 50)
    ages = []
    age = None
    ethnicities = []
    ethnicity = None
    start = time.time()
    with tempfile.TemporaryDirectory() as tmp_dir_name:
        for image in images:
            image_path = Path(tmp_dir_name) / "tmp_file.png"
            image.save(image_path)
            try:
                result = DeepFace.analyze(
                    img_path=str(image_path),
                    actions=["age", "race"],
                    enforce_detection=True,
                    detector_backend="ssd",
                    prog_bar=False,
                )
                if debug:
                    open_cv_image = cv2.imread(str(image_path))
                    open_cv_image = open_cv_image[:, :, ::-1].copy()
                    print(result)
                    cv2.rectangle(
                        open_cv_image,
                        (result["region"]["x"], result["region"]["y"]),
                        (result["region"]["x"]+result["region"]["w"], result["region"]["y"]+result["region"]["h"]),
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
