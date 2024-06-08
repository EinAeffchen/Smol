from django.db import models
from datetime import datetime
from pathlib import Path
import django
from django.conf import settings


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
            models.Index(fields=["rating"]),
            models.Index(fields=["path"]),
        ]

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
    rating = models.IntegerField(null=True)

    def __str__(self):
        return f"{self.filename}"

    def _delete_previews(self):
        preview = settings.PREVIEW_DIR / f"{self.id}.jpg"
        if preview.is_file():
            preview.unlink()
        print(f"deleted {preview}")
        thumbnail = settings.THUMBNAIL_DIR / f"{self.id}.jpg"
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
        self._delete_previews()
        self.delete()

    def delete_entry(self):
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

    def age(self):
        today = datetime.now().date()
        if self.birth_year:
            return today.year - self.birth_year
        else:
            return

    def delete_full(self):
        print(f"Deleting {self.id}...")
        self._delete_person_profile()
        self.delete()

    def __str__(self):
        return f"{self.forename} {self.surname}"


class PersonVideoFunction(models.Model):
    person_id = models.ForeignKey(Person, on_delete=models.CASCADE)
    video_id = models.ForeignKey(Video, on_delete=models.CASCADE)
    function = models.TextField(null=False)
