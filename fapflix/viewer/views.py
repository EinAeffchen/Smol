import random
from datetime import datetime
from pathlib import Path

from django.conf.urls.static import static
from django.core.files import File
from django.db import IntegrityError
from django.db.models import Count, F, Q
from django.db.models.fields import CharField, IntegerField
from django.db.models.query import Prefetch
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.views.generic.edit import CreateView, DeleteView, FormView, UpdateView
from PIL.Image import Image

from .forms import ActorForm, FilterForm, ImageForm, LabelForm
from .models import Actors, Labels, Videos, Images
from django.conf import settings
from .video_processor import (
    get_videos_containing_actor,
    generate_previews_thumbnails,
    post_process_videos,
    post_process_images,
    clean_recognize_pkls,
)

path = Path(__file__).resolve().parent
path = path / "static/viewer/images"
THUMBNAIL_DIR = path / "thumbnails"
PREVIEW_DIR = path / "previews"
FULL_FACE_PATH = Path(settings.MEDIA_ROOT) / "images/full_faces"


class IndexView(generic.ListView):
    template_name = "viewer/index.html"
    model = Videos

    def get_queryset(self):
        videos = Videos.objects.filter().order_by("-rating")[:18]
        return videos

    def get_context_data(self, **kwargs):
        # Call the base implementation first to get a context
        context = super().get_context_data(**kwargs)
        videos = Videos.objects.all()
        context["age"] = self.request.GET.get("age", [])
        context["quality"] = self.request.GET.get("quality", [])
        context["order"] = self.request.GET.get("order")
        context["duration"] = 0
        if self.request.GET.get("h"):
            h = self.request.GET.get("h")
            context["duration"] += int(h) * 60 * 60
        if self.request.GET.get("m"):
            m = self.request.GET.get("m")
            context["duration"] += int(m) * 60
        if context["age"]:
            videos = videos.filter(actor_age__lte=context["age"])
        if context["duration"]:
            videos = videos.filter(duration__gte=context["duration"])
        if context["quality"]:
            print(f"q {context['quality']}")
            videos = videos.filter(dim_height__gte=context["quality"])
        # Add in a QuerySet of all the videos
        if context["order"]:
            if context["order"] == "quality asc":
                order = "dim_height"
            elif context["order"] == "quality desc":
                order = "-dim_height"
            elif context["order"] == "age asc":
                order = "actor_age"
            elif context["order"] == "age desc":
                order = "-actor_age"
            elif context["order"] == "duration asc":
                order = "duration"
            elif context["order"] == "duration desc":
                order = "-duration"
            rating_order = (order, "-rating")
            inserted_order = (order, "-inserted_at")
        else:
            rating_order = ["-rating"]
            inserted_order = ["-inserted_at"]
        context["result_videos1"] = videos.order_by(*rating_order)[:60]
        context["result_videos2"] = videos.order_by(*inserted_order)[:60]
        context["result_videos3"] = videos.filter(favorite=True)[:60]
        if not self.request.GET:
            context["label_videos"] = dict()
            active_labels = [
                (label.id, label.label)
                for label in Labels.objects.annotate(video_count=Count("videos"))
                .filter(videos__isnull=False)
                .filter(video_count__gte=6)
                .distinct()
            ]
            if len(active_labels) >= 5:
                label_lists = random.sample(active_labels, 5)
                for label in label_lists:
                    context["label_videos"][label[1]] = Videos.objects.filter(
                        labels=label[0]
                    )
        context["actors"] = Actors.objects.all()[:6]
        return context


class EditActorView(UpdateView, generic.DetailView):
    template_name = "viewer/edit_actor.html"
    form_class = ActorForm
    success_url = "/actors/"
    model = Actors

    def form_valid(self, form):
        # This method is called when valid form data has been POSTed.
        # It should return an HttpResponse.
        form.save()
        print(self.request.POST)
        return super().form_valid(form)


class CreateActorView(CreateView):
    model = Actors
    fields = ["videos"]

    def form_valid(self, form):
        actor = form.save()
        actor.forename = "unknown"
        actor.surname = "unknown"
        actor.save()
        video_id = self.request.POST.get("videos[]")
        video_obj = Videos.objects.filter(id=video_id).first()
        print(f"id: {video_obj.id}")
        related_videos, related_images = get_videos_containing_actor(
            video_obj.id, "videos"
        )
        if related_videos:
            print(f"related videos: {related_videos}")
            print(f"video: {related_videos[0]}")
            face = FULL_FACE_PATH / f"{related_videos[0]}_face.jpg"
            print(f"Found face: {face}")
            related_video_objs = Videos.objects.filter(id__in=related_videos).all()
            ages = list()
            labels = list()
            for video_obj in related_video_objs:
                actor.videos.add(video_obj.id)
                if video_obj.actor_age:
                    ages.append(video_obj.actor_age)
                labels += [label.id for label in video_obj.labels.all()]
            labels = list(set(labels))
            [actor.labels.add(label) for label in labels]
            if not actor.birth_year and ages:
                actor.birth_year = datetime.now().year - min(ages)
            if face:
                face_filename = Path(face).name
                actor.avatar.save(face_filename, File(open(face, "rb")))
                actor.save()
        if related_images:
            face = FULL_FACE_PATH / f"image_{related_images[0]}_face.jpg"
            print(f"related images: {related_images}")
            related_image_objs = Images.objects.filter(id__in=related_images).all()
            for image_obj in related_image_objs:
                actor.images.add(image_obj.id)
            if face:
                face_filename = Path(face).name
                actor.avatar.save(face_filename, File(open(face, "rb")))
            actor.save()
        return JsonResponse({"actor-id": actor.id})


def updateActor(request):
    if request.method == "POST":
        actor_id = request.POST.get("actor")
        actor_obj = Actors.objects.filter(id=actor_id).first()
        videos = [str(video.id) for video in actor_obj.videos.all()]
        images = [str(image.id) for image in actor_obj.images.all()]
        print("Matches by videos:")
        related_videos, related_images = get_videos_containing_actor(videos, "videos")
        print("Matches by images:")
        related_videos2, related_images2 = get_videos_containing_actor(images, "images")

        print(f"Actor has avater: {bool(actor_obj.avatar)}")
        if not actor_obj.avatar:
            face = FULL_FACE_PATH / f"{related_videos[0]}_face.jpg"
            print(f"Found face: {face}")
            face_filename = Path(face).name
            actor_obj.avatar.save(face_filename, File(open(face, "rb")))
            actor_obj.save()

        related_videos = list(set(related_videos + related_videos2))
        related_images = list(set(related_images + related_images2))
        print(f"related videos: {related_videos}")
        print(f"related images: {related_images}")
        if related_videos:
            related_videos = list(related_videos)
            related_video_objs = Videos.objects.filter(id__in=related_videos).all()
            ages = list()
            labels = list()
            for video_obj in related_video_objs:
                actor_obj.videos.add(video_obj.id)
                if video_obj.actor_age:
                    ages.append(video_obj.actor_age)
                labels += [label.id for label in video_obj.labels.all()]
            labels = list(set(labels))
            [actor_obj.labels.add(label) for label in labels]
            if not actor_obj.birth_year and ages:
                actor_obj.birth_year = datetime.now().year - min(ages)
            actor_obj.save()
        if related_images:
            related_images = list(related_images)
            related_image_objs = Images.objects.filter(id__in=related_images).all()
            for image_obj in related_image_objs:
                actor_obj.images.add(image_obj.id)
                actor_obj.save()
        return JsonResponse({"actor-id": actor_obj.id})


class DeleteActorView(DeleteView):
    model = Actors
    success_url = reverse_lazy("viewer:actors")


class LabelView(FormView, generic.ListView):
    template_name = "viewer/labels.html"
    form_class = LabelForm
    success_url = reverse_lazy("viewer:labels")
    model = Labels

    def post(self, request, *args, **kwargs):
        form = LabelForm(request.POST)
        context = dict()
        print(request.POST)
        if form.is_valid():
            try:
                label = request.POST["label"].lower()
                label_obj = Labels(label=label)
                label_obj.save()
            except IntegrityError:
                context["error"] = f"Label {label} already exists!"
        labels = Labels.objects.order_by("label")
        context["object_list"] = labels
        context["form"] = self.form_class
        return render(request, "viewer/labels.html", context)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["form"] = LabelForm()
        context["form"].widget = CharField()
        return context


def delete_label(request, pk):
    if request.method == "GET":
        Labels.objects.filter(id=pk).delete()
    return redirect(reverse("viewer:labels"))


def add_video_label(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        label_id = request.POST["label_id"]
        label_obj = Labels.objects.filter(id=label_id).first()
        video_obj = Videos.objects.filter(id=video_id).first()
        if label_obj in video_obj.labels.all():
            return HttpResponseBadRequest("Label already added!")
        video_obj.labels.add(label_obj)
        video_obj.save()
    return JsonResponse({"label": label_obj.label, "label_id": label_obj.id})


def delete_video_label(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        label_id = request.POST["label_id"]
        label_obj = Labels.objects.filter(id=label_id).first()
        video_obj = Videos.objects.filter(id=video_id).first()
        video_obj.labels.remove(label_obj)
    return HttpResponse("OK")


def delete_actor_label(request):
    if request.method == "POST":
        actor_id = request.POST["actor_id"]
        label_id = request.POST["label_id"]
        label_obj = Labels.objects.filter(id=label_id).first()
        actor_obj = Actors.objects.filter(id=actor_id).first()
        actor_obj.labels.remove(label_obj)
    return HttpResponse("OK")


def actor_remove_video(request):
    if request.method == "POST":
        actor_id = request.POST["actor_id"]
        video_id = request.POST["video_id"]
        actor_obj = Actors.objects.filter(id=actor_id).first()
        video_obj = Videos.objects.filter(id=video_id).first()
        actor_obj.videos.remove(video_obj)
    return HttpResponse("OK")


def actor_remove_image(request):
    if request.method == "POST":
        actor_id = request.POST["actor_id"]
        image_id = request.POST["image_id"]
        actor_obj = Actors.objects.filter(id=actor_id).first()
        image_obj = Images.objects.filter(id=image_id).first()
        actor_obj.images.remove(image_obj)
    return HttpResponse("OK")


class DataLoader(generic.ListView):
    template_name = "viewer/loader.html"
    model = Videos

    def get_context_data(self, **kwargs):
        context = super(DataLoader, self).get_context_data(**kwargs)
        context["video_count"] = self.get_queryset().count()
        context["image_count"] = Images.objects.all().count()
        return context


class VideoView(generic.DetailView):
    model = Videos
    template_name = "viewer/video.html"

    def get_context_data(self, **kwargs):
        context = super(generic.DetailView, self).get_context_data(**kwargs)
        video = context["object"]
        context["labels"] = Labels.objects.all().order_by("label")
        context["video"] = video
        context["recommendations"] = (
            Videos.objects.filter(labels__in=video.labels.all())
            .exclude(id=video.id)
            .distinct()
        )
        return context


class ActorView(generic.DetailView):
    model = Actors
    template_name = "viewer/actor.html"

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        form = ImageForm(request.POST, request.FILES, instance=self.object)
        print(request.POST)
        if form.is_valid():
            # Write Your Logic here
            form.save()
            img_obj = form.instance
            context = super(ActorView, self).get_context_data(**kwargs)
            context["img_obj"] = img_obj
            context["form"] = ImageForm
            context["delete_form"] = DeleteActorView
            return self.render_to_response(context=context)
        else:
            self.object = self.get_object()
            context = super(ActorView, self).get_context_data(**kwargs)
            context["form"] = form
            context["delete_form"] = DeleteActorView
            return self.render_to_response(context=context)

    def get_faces(self, context):
        faces = list()
        actor = context["object"]
        for video in actor.videos.all():
            if (FULL_FACE_PATH / f"{video.id}_face.jpg").is_file():
                faces.append(f"{video.id}_face.jpg")
        return faces

    def get(self, request, *args, **kwargs):
        self.object = self.get_object()
        context = self.get_context_data(object=self.object)
        context["form"] = ImageForm
        context["delete_form"] = DeleteActorView
        context["faces"] = self.get_faces(context)
        return self.render_to_response(context)

    def get_context_data(self, **kwargs):
        context = super(generic.DetailView, self).get_context_data(**kwargs)
        actor = context["object"]
        context["best_rated"] = actor.videos.order_by("-rating").first()
        return context


class ActorsView(generic.ListView):
    model = Actors
    template_name = "viewer/actors.html"


class LabelResultView(generic.DetailView):
    model = Labels
    template_name = "viewer/index.html"

    def get_context_data(self, **kwargs):
        context = super(generic.DetailView, self).get_context_data(**kwargs)
        label = context["object"]
        context["result_videos1"] = Videos.objects.filter(labels=label).order_by(
            "-rating"
        )[:30]
        context["result_videos2"] = Videos.objects.filter(labels=label).order_by(
            "-inserted_at"
        )[:30]
        context["result_videos3"] = Videos.objects.filter(labels=label).order_by(
            "-favorite"
        )[:30]
        context["actors"] = label.actors_set.all()
        return context


class VideoList(generic.ListView):
    form_class = FilterForm
    template_name = "viewer/resultset.html"
    model = Videos
    paginate_by = 15
    context_object_name = "result_videos"
    ordering = ["-rating"]

    def get_filter(self, get):
        if "filter" in get:
            return "-" + get["filter"]
        else:
            return "-rating"

    def get_context_data(self, **kwargs):
        context = super(generic.ListView, self).get_context_data(**kwargs)
        context["form"] = self.form_class
        return context


class VideoOverview(generic.ListView):
    paginate_by = 16
    model = Videos
    template_name = "viewer/overview.html"
    ordering = ["-inserted_at"]


class ImageOverview(generic.ListView):
    paginate_by = 16
    model = Images
    template_name = "viewer/overview_images.html"
    ordering = ["-inserted_at"]


class SearchView(VideoList):
    template_name = "viewer/search.html"

    def get_queryset(self):
        search_query = self.request.GET["query"]
        title = Videos.objects.filter(labels__label__in=search_query)
        return title

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        search_query = self.request.GET["query"]
        context["videos"] = Videos.objects.filter(filename__icontains=search_query)
        context["images"] = Images.objects.filter(filename__icontains=search_query)
        context["labels"] = Videos.objects.filter(labels__label__icontains=search_query)
        context["actors"] = Actors.objects.filter(
            Q(forename__icontains=search_query) | Q(surname__icontains=search_query)
        )
        return context


def load_data(request):
    clean_recognize_pkls()
    if not THUMBNAIL_DIR.is_dir():
        THUMBNAIL_DIR.mkdir()
    if not PREVIEW_DIR.is_dir():
        PREVIEW_DIR.mkdir()
    last = generate_previews_thumbnails(THUMBNAIL_DIR, PREVIEW_DIR)
    return JsonResponse(last)


def clean_data(request):
    counter = {"videos": 0, "images": 0}
    for video in Videos.objects.all():
        counter["videos"] += video.clean()
    for image in Images.objects.all():
        counter["images"] += image.clean()
    return JsonResponse(counter)


def post_process_video_controller(request):
    videos = Videos.objects.filter(processed=False).first()
    if not videos:
        return JsonResponse({"finished": True})
    result = post_process_videos(PREVIEW_DIR, videos)
    return JsonResponse(result)


def post_process_image_controller(request):
    images = Images.objects.filter(processed=False).first()
    if not images:
        return JsonResponse({"finished": True})
    result = post_process_images(images)
    return JsonResponse(result)


def add_actor(request):
    actor = Actors()
    actor.save()
    return redirect(reverse("viewer:actor", args=[actor.id]))


def add_favorite(request, videoid):
    vid_obj = Videos.objects.get(id=videoid)
    vid_obj.favorite = True
    vid_obj.save()
    return JsonResponse({"id": videoid, "status": True})


def add_favorite_image(request, imageid):
    imageid = int(imageid)
    vid_obj = Images.objects.get(id=imageid)
    vid_obj.favorite = True
    vid_obj.save()
    return JsonResponse({"id": imageid, "status": True})


def rem_favorite(request, videoid):
    vid_obj = Videos.objects.get(id=videoid)
    vid_obj.favorite = False
    vid_obj.save()
    return JsonResponse({"id": videoid, "status": False})


def rem_favorite_image(request, imageid):
    imageid = int(imageid)
    vid_obj = Images.objects.get(id=imageid)
    vid_obj.favorite = False
    vid_obj.save()
    return JsonResponse({"id": imageid, "status": False})


def rate_video(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        rating = request.POST["rating"]
        video_obj = Videos.objects.filter(id=video_id).first()
        video_obj.rating = rating
        video_obj.save()
    return HttpResponse("OK")


def change_age(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        age = request.POST["age"]
        video_obj = Videos.objects.filter(id=video_id).first()
        video_obj.actor_age = age
        video_obj.save()
    return HttpResponse("OK")


def rem_video(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        vid_obj = Videos.objects.filter(id=video_id).first()
        vid_obj.delete_full()
    return HttpResponse("OK")
