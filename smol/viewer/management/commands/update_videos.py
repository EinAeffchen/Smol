from django.core.management.base import BaseCommand
from viewer.models import Video


class Command(BaseCommand):
    def handle(self, *args, **options):
        video:Video
        for video in Video.objects.all():
            video.extracted_faces = True
            video.save()
