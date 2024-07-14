import pickle
from pathlib import Path

import cv2
import django
from deepface.modules import detection, representation
from django.conf import settings
from django.db import models
from PIL import Image as PILImage
from tqdm import tqdm


class Label(models.Model):
    label = models.TextField(unique=True)

    class Meta:
        ordering = ["label"]

    def __unicode__(self):
        return f"{self.label}"

    def __str__(self):
        return f"{self.label}"


class Video(models.Model):

    class Meta:
        indexes = [
            models.Index(fields=["filename"]),
            models.Index(fields=["path"]),
        ]

    id = models.IntegerField(primary_key=True)
    id_hash = models.TextField(unique=True, null=True)
    path = models.TextField(unique=True)
    filename = models.TextField()
    dim_height = models.IntegerField(null=True)
    dim_width = models.IntegerField(null=True)
    duration = models.FloatField()
    audiocodec = models.TextField(null=True)
    bitrate = models.BigIntegerField(null=True)
    size = models.BigIntegerField()
    videocodec = models.TextField(null=True)
    preview = models.TextField()
    thumbnail = models.TextField()
    processed = models.BooleanField(default=False)
    favorite = models.BooleanField(default=False)
    labels = models.ManyToManyField(Label)
    inserted_at = models.DateTimeField(default=django.utils.timezone.now)
    related_videos = models.ManyToManyField(
        "self",
        verbose_name="related videos",
        symmetrical=True,
        blank=True,
        through="VideoPersonMatch",
    )
    extracted_faces = models.BooleanField(default=False)
    ran_recognition = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.filename}"

    def _delete_previews(self):
        thumbnail = settings.THUMBNAIL_DIR / f"{self.id_hash}.jpg"
        if thumbnail.is_file():
            thumbnail.unlink()
        print(f"deleted {thumbnail}")

    def delete_full(self):
        obj = Path(self.path)
        print(f"Deleting {self.id_hash}...")
        try:
            obj.unlink()
        except (PermissionError, FileNotFoundError) as e:
            print("Couldn't delete, file busy or already deleted.")
        self._delete_previews()
        self.delete()

    def delete_entry(self):
        self._delete_previews()
        self.delete()
        print("DELETED")

    def file_exists(self):
        obj = Path(self.path)
        if obj.is_file():
            return True
        else:
            return False

    def clean(self):
        if not self.file_exists():
            self.delete()
            return 1
        return 0

    @property
    def full_path(self) -> Path:
        return settings.MEDIA_DIR / self.path

    def delete_encoding(self):
        if self.face_encoding_file.is_file():
            self.face_encoding_file.unlink()
        [face.unlink() for face in self.examples_faces]
        self.ran_recognition = False
        self.save()

    def create_encodings(self) -> list[dict]:
        if self.extracted_faces:
            print(f"{self.id} already has embeddings, skipping!")
            return
        movie = cv2.VideoCapture(self.full_path)
        total_frame_count = int(movie.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_number = 0
        face_count = 0
        full_face_encodings = []
        print("Starting recognition...")
        with tqdm(total=int(total_frame_count)) as pbar:
            while movie.isOpened():
                ret, frame = movie.read()

                if (
                    not ret
                    or face_count >= settings.RECOGNITION_FACE_COUNT
                    or frame_number >= total_frame_count
                ):
                    movie.release()
                    break
                if frame.shape[1] < 500:
                    frame = cv2.resize(frame, None, fx=2, fy=2)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                try:
                    img_objs = detection.extract_faces(
                        rgb_frame,
                        expand_percentage=20,
                        detector_backend=settings.RECOGNITION_DETECTION_BACKEND,
                    )
                except ValueError:
                    img_objs = []

                if img_objs:
                    for img_obj in img_objs:
                        confidence = img_obj["confidence"]
                        print(confidence)
                        if confidence < 0.8:
                            frame_jump = settings.RECOGNITION_FRAME_SKIP
                            continue
                        img_content = img_obj["face"]
                        img_region = img_obj["facial_area"]
                        embedding_obj = representation.represent(
                            img_path=img_content,
                            model_name=settings.RECOGNITION_MODEL,
                            detector_backend="skip",
                            normalization=settings.RECOGNITION_IMAGE_NORMALIZATION,
                        )
                        img_representation = embedding_obj[0]["embedding"]
                        # get more different kinds of faces
                        full_face_encodings.append(
                            {
                                "identity": f"{self.id_hash}",
                                "hash": self.id_hash,
                                "embedding": img_representation,
                                "target_x": img_region["x"],
                                "target_y": img_region["y"],
                                "target_w": img_region["w"],
                                "target_h": img_region["h"],
                            }
                        )
                        self.save_face(
                            face_count,
                            rgb_frame,
                            list(img_region.values())[:4],
                        )
                        frame_jump = int(total_frame_count / 10)
                        face_count += 1
                else:
                    frame_jump = settings.RECOGNITION_FRAME_SKIP
                frame_number += frame_jump
                movie.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
                pbar.update(frame_jump)

        if face_count > 0:
            with open(self.face_encoding_file, "wb") as f_out:
                pickle.dump(full_face_encodings, f_out)
        self.extracted_faces = True
        self.save()
        print("Finished extraction!")
        return full_face_encodings

    def save_face(
        self,
        face_count: int,
        rgb_frame: cv2.typing.MatLike,
        face_locations: list[int],
    ):
        if settings.RECOGNITION_STORE_FACES:
            HEIGHT, WIDTH = rgb_frame.shape[0:2]
            x, y, w, h = face_locations
            face_only = rgb_frame[
                max(0, y - 50) : min(y + h + 50, HEIGHT),
                max(0, x - 50) : min(x + w + 50, WIDTH),
            ]
            pil_image = PILImage.fromarray(face_only)
            face_folder: Path = self.recognition_data_path / str(self.id_hash)
            face_folder.mkdir(exist_ok=True, parents=True)
            try:
                pil_image.save(
                    face_folder / f"{self.id_hash}_{face_count}.jpg"
                )
            except ValueError:
                print("Can't save face as image!")

    @property
    def recognition_data_path(self) -> Path:
        path: Path = settings.RECOGNITION_DATA_PATH
        path.mkdir(exist_ok=True, parents=True)
        return path

    @property
    def examples_faces(self) -> list[Path]:
        return list(
            (self.recognition_data_path / str(self.id_hash)).glob("*.jpg")
        )

    @property
    def face_encoding_file(self) -> Path:
        return self.recognition_data_path / f"{str(self.id_hash)}.pkl"

    @property
    def face_encodings(self) -> dict:
        if self.face_encoding_file.is_file():
            with open(self.face_encoding_file, "rb") as f_in:
                return pickle.load(f_in)
        else:
            print(f"No Encoding file found for {self.id}. Creating...")
            return self.create_encodings()


class VideoPersonMatch(models.Model):
    class Meta:
        ordering = ["-score"]
        indexes = [
            models.Index(fields=["score"]),
        ]
        models.UniqueConstraint(
            fields=["source_video", "related_video"], name="unique_relation"
        )

    source_video = models.ForeignKey(
        Video, on_delete=models.CASCADE, related_name="from_video"
    )
    related_video = models.ForeignKey(
        Video, on_delete=models.CASCADE, related_name="to_video"
    )
    score = models.FloatField(null=False)


class Image(models.Model):
    path = models.TextField(unique=True)
    filename = models.TextField()
    dim_height = models.IntegerField(null=True)
    dim_width = models.IntegerField(null=True)
    size = models.IntegerField()
    processed = models.BooleanField(default=False)
    favorite = models.BooleanField(default=False)
    inserted_at = models.DateField(default=django.utils.timezone.now)
    labels = models.ManyToManyField(Label)

    def delete_full(self):
        obj = Path(self.path)
        print(f"Deleting {self.id}...")
        try:
            obj.unlink()
        except (PermissionError, FileNotFoundError) as e:
            print("Couldn't delete, file busy or already deleted.")
        self.delete()

    def clean(self):
        if not self.file_exists():
            self.delete()
            return 1
        return 0

    def file_exists(self):
        obj = Path(self.path)
        if obj.is_file():
            return True
        else:
            return False

    def __str__(self):
        return f"{self.filename}"

    class Meta:
        ordering = ["-inserted_at"]
        indexes = [
            models.Index(fields=["path"]),
        ]


class Person(models.Model):
    class Meta:
        ordering = ["surname", "forename"]
        indexes = [
            models.Index(fields=["forename"]),
            models.Index(fields=["surname"]),
            models.Index(fields=["function"]),
        ]

    forename = models.TextField(null=True)
    surname = models.TextField(null=True)
    birth_year = models.IntegerField(null=True)
    nationality = models.TextField(null=True)
    labels = models.ManyToManyField(Label, blank=True)
    video_files = models.ManyToManyField(Video, blank=True)
    images = models.ManyToManyField(Image, blank=True)
    avatar = models.ImageField(
        upload_to="images/person_profiles/", null=True, blank=True
    )
    function = models.TextField(null=True)

    def delete_full(self):
        print(f"Deleting {self.id}...")
        self.delete()

    def __str__(self):
        return f"{self.forename} {self.surname}"
