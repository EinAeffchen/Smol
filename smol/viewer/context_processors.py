from .models import Video
import random


def random_video(request):
    rvideos = Video.objects.order_by('?')[:33]
    if rvideos:
        rvideo = random.choice(rvideos)
    else:
        rvideo = None
    return {"rvideo": rvideo, "rvideos": rvideos}
