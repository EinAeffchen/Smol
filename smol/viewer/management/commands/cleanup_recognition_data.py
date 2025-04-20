from django.core.management.base import BaseCommand
from viewer.models import Video


class Command(BaseCommand):
    def handle(self, *args, **options):
        for video in Video.objects.all():
            video.delete_encoding()
            video.ran_recognition = False
