import tempfile
from pathlib import Path

import numpy as np
from deepface import DeepFace

from .utils import split_image


def average(lst):
    return sum(lst) / len(lst)


def most_common(lst):
    return max(lst, key=lst.count)


def get_age_ethnic(image_file: Path):
    print(image_file)
    images = split_image(image_file)
    ages = []
    age = None
    ethnicities = []
    ethnicity = None
    with tempfile.TemporaryDirectory() as tmp_dir_name:
        for image in images:
            image_path = Path(tmp_dir_name) / "tmp_file.png"
            image.save(image_path)
            try:
                result = DeepFace.analyze(
                    img_path=str(image_path),
                    actions=["age", "race"],
                    enforce_detection=True,
                    detector_backend="opencv",
                    prog_bar=False,
                )
                open_cv_image = np.array(image)
                open_cv_image = open_cv_image[:, :, ::-1].copy()
                ages.append(result["age"])
                ethnicities.append(result["dominant_race"])
            except ValueError:
                pass
        if ages:
            age = average(ages)
        if ethnicities:
            ethnicity = most_common(ethnicities)
        print(age, ethnicity)
        return age, ethnicity


# path = Path(__file__).parent / "static/viewer/images/previews"
# with tempfile.TemporaryDirectory() as tmp_dir_name:
#     for image_file in path.iterdir():
#         if image_file.suffix in [".png"]:
#            get_age_ethnic(image_file)
