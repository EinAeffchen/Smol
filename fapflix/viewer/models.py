from django.db import models
from datetime import datetime
import django


class Labels(models.Model):
    label = models.TextField(unique=True)

    class Meta:
        ordering = ["label"]


class Videos(models.Model):
    path = models.TextField(unique=True)
    filename = models.TextField()
    dim_height = models.IntegerField(null=True)
    dim_width = models.IntegerField(null=True)
    duration = models.FloatField()
    audiocodec = models.TextField(null=True)
    bitrate = models.IntegerField(null=True)
    size = models.IntegerField()
    videocodec = models.TextField(null=True)
    preview = models.TextField()
    thumbnail = models.TextField()
    processed = models.BooleanField()
    rating = models.FloatField(default=0)
    favorite = models.BooleanField(default=False)
    labels = models.ManyToManyField(Labels)
    inserted_at = models.DateTimeField(default=django.utils.timezone.now)
    actor_age = models.IntegerField(null=True)


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


class Actors(models.Model):
    forename = models.TextField()
    surname = models.TextField()
    birth_year = models.IntegerField()
    nationality = models.TextField()
    labels = models.ManyToManyField(Labels)
    videos = models.ManyToManyField(Videos)
    images = models.ManyToManyField(Images)
    avatar = models.TextField(unique=True)

    def age(self):
        today = datetime.now().date()
        return today.year-self.birth_year