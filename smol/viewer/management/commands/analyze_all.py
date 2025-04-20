from django.core.management.base import BaseCommand
from viewer.models import Video
from viewer.video_processor import recognize_faces, add_labels_by_path


class Command(BaseCommand):
    def handle(self, *args, **options):
        for video in Video.objects.all():
            add_labels_by_path(video)
            video.face_encodings
        print("Finished creating encodings! Starting Recognition")
        for video in Video.objects.all():
            if not video.ran_recognition:
                recognize_faces(video)
            video.ran_recognition = True
