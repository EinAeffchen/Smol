from django.core.management.base import BaseCommand
from viewer.models import Video
from viewer.video_processor import recognize_faces
from tqdm import tqdm


class Command(BaseCommand):
    def handle(self, *args, **options):
        for video in tqdm(Video.objects.all()):
            print("Analyzing ", video.id)
            video.face_encodings
        print("Finished creating encodings! Starting Recognition")
        # for video in tqdm(Video.objects.all()):
        #     if (
        #         len(video.related_videos.all()) <= 1
        #         and not video.ran_recognition
        #     ):
        #         print("Recognizing ", video.filename)
        #         recognize_faces(video)
        #     else:
        #         print("Video already got related videos. Skipping!")
        #     video.ran_recognition = True
