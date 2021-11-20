from django.db import models
from datetime import datetime
from pathlib import Path
import django


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
            models.Index(fields=["age_rating"]),
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
    year = models.IntegerField(null=True)
    age_rating = models.IntegerField(null=True)

    def __str__(self):
        return f"{self.filename}"

    def _delete_faces(self):
        path = Path("/srv/data/moars/media/images/faces")
        faces = path.glob(f"{self.id}_*.jpg")
        for face in faces:
            face.unlink()
            print(f"Deleted face: {face}")
        full_face = path.parent / "full_faces" / f"{self.id}_face.jpg"
        if full_face.is_file():
            full_face.unlink()

    def _delete_previews(self):
        path = Path("/srv/data/moars/viewer/static/viewer/images")
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


class Show(models.Model):
    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["year"]),
        ]

    name = models.TextField(null=True)
    matching_name = models.TextField(null=True)
    overview = models.TextField(null=True)
    year = models.IntegerField(null=True)
    network = models.TextField(null=True)
    poster = models.TextField(null=True)
    backdrop = models.TextField(null=True)
    rating = models.FloatField(null=False, default=0.0)
    labels = models.ManyToManyField(Label)
    origin_country = models.TextField(null=True)


class Episode(models.Model):
    media_id = models.OneToOneField(Video, on_delete=models.CASCADE)
    show_id = models.ForeignKey(Show, on_delete=models.CASCADE)
    name = models.TextField(null=True)
    season = models.IntegerField(null=False, default=1)
    episode = models.IntegerField(null=False, default=1)
    air_date = models.DateField(null=True)
    class Meta:
        ordering = ["name"]

    def __unicode__(self):
        return f"{self.name}"

    def __str__(self):
        return f"{self.name}"


class Movie(models.Model):
    media_id = models.OneToOneField(Video, on_delete=models.CASCADE)
    title = models.TextField(null=True)
    adult = models.BooleanField(null=False, default=False)
    release_date = models.DateField(null=True)
    overview = models.TextField(null=True)
    rating = models.FloatField(null=False, default=0.0)



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
    actor_age = models.IntegerField(null=True)

    def _delete_faces(self):
        path = Path("/srv/data/moars/media/images/faces")
        faces = path.glob(f"image_{self.id}.jpg")
        for face in faces:
            face.unlink()
            print(f"Deleted face: {face}")
        full_face = path.parent / "full_faces" / f"image_{self.id}_face.jpg"
        if full_face.is_file():
            full_face.unlink()

    def delete_full(self):
        obj = Path(self.path)
        print(f"Deleting {self.id}...")
        try:
            obj.unlink()
        except (PermissionError, FileNotFoundError) as e:
            print("Couldn't delete, file busy or already deleted.")
        self._delete_faces()
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
    shows = models.ManyToManyField(Show, blank=True)
    images = models.ManyToManyField(Image, blank=True)
    avatar = models.ImageField(
        upload_to="images/actor_profiles/", null=True, blank=True
    )
    function = models.TextField(null=True)

    def age(self):
        today = datetime.now().date()
        if self.birth_year:
            return today.year - self.birth_year
        else:
            return

    def _delete_person_profile(self):
        media_path = Path("/srv/data/moars/media/")
        profile_path = media_path / str(self.avatar)
        print(profile_path)
        try:
            profile_path.unlink()
        except (PermissionError, FileNotFoundError) as e:
            print("Couldn't delete, file busy or already deleted.")

    def delete_full(self):
        print(f"Deleting {self.id}...")
        self._delete_person_profile()
        self.delete()

    def __str__(self):
        return f"{self.forename} {self.surname}"


class PersonMediaFunction(models.Model):
    person_id = models.ForeignKey(Person, on_delete=models.CASCADE)
    media_id = models.ForeignKey(Video, on_delete=models.CASCADE)
    function = models.TextField(null=False)
