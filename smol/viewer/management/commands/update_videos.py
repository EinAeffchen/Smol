from django.core.management.base import BaseCommand
from viewer.models import Video
from tqdm import tqdm


class Command(BaseCommand):
    def handle(self, *args, **options):
        video:Video
        for video in tqdm(Video.objects.all()):
            video.extracted_faces = True
            video.save()
