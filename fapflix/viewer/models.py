from django.db import models
from datetime import datetime
from pathlib import Path
import django
from numpy.core.numeric import full


class Labels(models.Model):
    label = models.TextField(unique=True)

    class Meta:
        ordering = ["label"]

    def __unicode__(self):
        return f"{self.label}"

    def __str__(self):
        return f"{self.label}"


class Videos(models.Model):
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
    processed = models.BooleanField()
    rating = models.FloatField(default=0)
    favorite = models.BooleanField(default=False)
    labels = models.ManyToManyField(Labels)
    inserted_at = models.DateTimeField(default=django.utils.timezone.now)
    actor_age = models.IntegerField(null=True)

    def __str__(self):
        return f"{self.filename}"

    def _delete_faces(self):
        path = Path("/srv/data/fapflix/media/images/faces")
        faces = path.glob(f"{self.id}_*.jpg")
        for face in faces:
            face.unlink()
            print(f"Deleted face: {face}")
        full_face = path.parent / "full_faces" / f"{self.id}_face.jpg"
        if full_face.is_file():
            full_face.unlink()

    def _delete_previews(self):
        path = Path("/srv/data/fapflix/viewer/static/viewer/images")
        previews = path / "previews/"
        thumbnails = path / "thumbnails/"
        preview = previews / f"{self.id}.jpg"
        if preview.is_file():
            preview.unlink()
        print(f"deleted {preview}")
        thumbnail = thumbnails / f"{self.id}.jpg"
        if thumbnail.is_file():
            thumbnail.unlink()
        print(f"deleted {thumbnail}")

    def delete_full(self):
        obj = Path(self.path)
        print(f"Deleting {self.id}...")
        try:
            obj.unlink()
        except (PermissionError, FileNotFoundError) as e:
            print("Couldn't delete, file busy or already deleted.")
        self._delete_faces()
        self._delete_previews()
        self.delete()

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

    class Meta:
        ordering = ["?"]
        indexes = [
            models.Index(fields=["path"]),
        ]


class Images(models.Model):
    path = models.TextField(unique=True)
    filename = models.TextField()
    dim_height = models.IntegerField(null=True)
    dim_width = models.IntegerField(null=True)
    size = models.IntegerField()
    processed = models.BooleanField(default=False)
    favorite = models.BooleanField(default=False)
    inserted_at = models.DateField(default=django.utils.timezone.now)
    labels = models.ManyToManyField(Labels)
    actor_age = models.IntegerField(null=True)

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


class Actors(models.Model):
    forename = models.TextField(null=True)
    surname = models.TextField(null=True)
    birth_year = models.IntegerField(null=True)
    nationality = models.TextField(null=True)
    labels = models.ManyToManyField(Labels, blank=True)
    videos = models.ManyToManyField(Videos, blank=True)
    images = models.ManyToManyField(Images, blank=True)
    avatar = models.ImageField(
        upload_to="images/actor_profiles/", null=True, blank=True
    )

    def age(self):
        today = datetime.now().date()
        if self.birth_year:
            return today.year - self.birth_year
        else:
            return

    def __str__(self):
        return f"{self.forename} - {self.surname} - {self.birth_year}"
