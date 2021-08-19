from django.db import models
from datetime import datetime
import django


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


class Images(models.Model):
    path = models.TextField(unique=True)
    filename = models.TextField()
    dim_height = models.IntegerField(null=True)
    dim_width = models.IntegerField(null=True)
    size = models.IntegerField()
    thumbnail = models.TextField()
    processed = models.BooleanField()
    rating = models.IntegerField(
        choices=[(0, "0"), (1, "1"), (2, "2"), (3, "3"), (4, "4"), (5, "5")],
    )
    favorite = models.BooleanField()
    inserted_at = models.DateField(default=django.utils.timezone.now)
    labels = models.ManyToManyField(Labels)

    def __str__(self):
        return f"{self.filename}"

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
