from .models import Videos
import random


def random_video(request):
    rvideos = Videos.objects.all()
    if rvideos:
        rvideo = random.choice(rvideos)
    else:
        rvideo = None
    return {"rvideo": rvideo, "rvideos": rvideos}
