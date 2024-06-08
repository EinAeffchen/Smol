import json
from pathlib import Path

from django.conf import settings
from django.core import serializers
from django.db import IntegrityError
from django.db.models import Q
from django.db.models.fields import CharField
from django.http import (
    HttpResponse,
    JsonResponse,
)
from django.shortcuts import redirect, render
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.views.decorators.http import require_POST
from django.views.generic.edit import FormView

from viewer.video_processor import (
    generate_thumbnail,
    add_labels_by_path,
    read_video_info,
)

from .forms import FilterForm, LabelForm
from .models import Image, Label, Video
from .video_processor import generate_previews_thumbnails


class IndexView(generic.ListView):
    template_name = "viewer/index.html"
    model = Video

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["videos"] = Video.objects.order_by("?")[:50]
        context["images"] = Image.objects.order_by("?")[:50]
        return context


class LabelView(FormView, generic.ListView):
    template_name = "viewer/labels.html"
    form_class = LabelForm
    success_url = reverse_lazy("viewer:labels")
    model = Label

    def post(self, request, *args, **kwargs):
        form = LabelForm(request.POST)
        context = dict()
        if form.is_valid():
            try:
                label = request.POST["labels"].lower().strip()
                label_obj = Label(label=label)
                label_obj.save()
            except IntegrityError:
                context["error"] = f"Label {label} already exists!"
        labels = Label.objects.order_by("label")
        context["object_list"] = labels
        context["form"] = self.form_class
        return render(request, "viewer/labels.html", context)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        print(context)
        context["form"] = LabelForm()
        context["form"].widget = CharField()
        return context


def delete_label(request, pk):
    if request.method == "GET":
        Label.objects.filter(id=pk).delete()
    return redirect(reverse("viewer:labels"))


def get_new_files(request) -> JsonResponse:
    new_files = list()
    for suffix in settings.VIDEO_SUFFIXES:
        for video in settings.MEDIA_DIR.rglob(f"*{suffix}"):
            file_path = video.relative_to(settings.MEDIA_ROOT)
            if not Video.objects.filter(path=file_path):
                print("Found:", file_path)
                new_files.append(str(file_path))
    return JsonResponse(data={"count": len(new_files), "paths": new_files})


@require_POST
def load_file(request, *args, **kwargs) -> JsonResponse:
    if request.method == "POST":
        body = json.loads(request.body)
        print("Processing: ", body["path"])
        path = body["path"]
        if Video.objects.filter(path=path):
            return HttpResponse("Document already imported!", status=409)
        video_path = settings.MEDIA_DIR / path
        video_data = read_video_info(video_path)
        relative_video_path = video_path.relative_to(settings.MEDIA_ROOT)
        video_data["size"] = video_path.stat().st_size
        video_data["path"] = relative_video_path
        video_data["filename"] = video_path.name
        video_obj = Video(**video_data)
        video_obj.processed = False
        video_obj.save()
        video_obj.thumbnail = generate_thumbnail(video_obj, video_path)
        add_labels_by_path(video_obj, relative_video_path)
        video_obj.save()
        return JsonResponse(
            {"file": body["path"], "thumbnail": video_obj.thumbnail}
        )


def add_video_label(request):
    print(request.body)
    if request.method == "POST":
        post_data = json.loads(request.body)
        video_id = post_data["video_id"]
        labels = post_data["labels"]
        label_objs = Label.objects.filter(label__in=labels).all()
        video_obj = Video.objects.filter(id=video_id).first()
        video_obj.labels.clear()
        [video_obj.labels.add(label_obj) for label_obj in label_objs]
        video_obj.save()
    return JsonResponse({"labels": labels})


def delete_video_label(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        label_id = request.POST["label_id"]
        label_obj = Label.objects.filter(id=label_id).first()
        video_obj = Video.objects.filter(id=video_id).first()
        video_obj.labels.remove(label_obj)
    return HttpResponse("OK")


class DataLoader(generic.ListView):
    template_name = "viewer/loader.html"
    model = Video

    def get_context_data(self, **kwargs):
        context = super(DataLoader, self).get_context_data(**kwargs)
        context["video_count"] = self.get_queryset().count()
        context["image_count"] = Image.objects.all().count()
        return context


class VideoView(generic.DetailView):
    model = Video
    template_name = "viewer/video.html"

    def get_context_data(self, **kwargs):
        context = super(generic.DetailView, self).get_context_data(**kwargs)
        video = context["object"]
        context["labels"] = serializers.serialize(
            "json", Label.objects.all().order_by("label")
        )
        context["video"] = video
        context["dataframes"] = settings.PREVIEW_IMAGES
        context["recommendations"] = (
            Video.objects.filter(labels__in=video.labels.all())
            .exclude(id=video.id)
            .distinct()
            .order_by("?")[:50]
        )
        return context


class VideoList(generic.ListView):
    form_class = FilterForm
    template_name = "viewer/resultset.html"
    model = Video
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
    model = Video
    template_name = "viewer/overview.html"
    ordering = ["-inserted_at"]

    def get_context_data(self, **kwargs):
        context = super(generic.ListView, self).get_context_data(**kwargs)
        context["dataframes"] = settings.PREVIEW_IMAGES
        return context


class ImageOverview(generic.ListView):
    paginate_by = 16
    model = Image
    template_name = "viewer/overview_images.html"
    ordering = ["-favorite", "-inserted_at"]


class SearchView(VideoList):
    template_name = "viewer/index.html"

    def get_queryset(self):
        search_query = self.request.GET["query"]
        title = Video.objects.filter(labels__label__in=search_query)
        return title

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        search_query = self.request.GET["query"]
        context["videos"] = Video.objects.filter(
            Q(filename__icontains=search_query)
            | Q(path__icontains=search_query)
        )
        context["images"] = Image.objects.filter(
            Q(filename__icontains=search_query)
            | Q(path__icontains=search_query)
        )
        return context


def load_data(request):
    return JsonResponse(generate_previews_thumbnails())


def clean_data(request):
    counter = {"videos": 0, "images": 0}
    for video in Video.objects.all():
        counter["videos"] += video.clean()
    for image in Image.objects.all():
        counter["images"] += image.clean()
    return JsonResponse(counter)


class LabelResultView(generic.DetailView):
    model = Label
    template_name = "viewer/index.html"

    def get_context_data(self, **kwargs):
        context = super(generic.DetailView, self).get_context_data(**kwargs)
        label_obj = context["object"]
        context["videos"] = Video.objects.filter(labels=label_obj).order_by(
            "-favorite"
        )[:50]
        context["images"] = Image.objects.filter(labels=label_obj).order_by(
            "-favorite"
        )[:50]
        return context


def add_favorite(request, videoid):
    vid_obj = Video.objects.get(id=videoid)
    vid_obj.favorite = True
    vid_obj.save()
    return JsonResponse({"id": videoid, "status": True})


def rem_favorite(request, videoid):
    vid_obj = Video.objects.get(id=videoid)
    vid_obj.favorite = False
    vid_obj.save()
    return JsonResponse({"id": videoid, "status": False})


def add_favorite_image(request, imageid):
    imageid = int(imageid)
    img_obj = Image.objects.get(id=imageid)
    img_obj.favorite = True
    img_obj.save()
    return JsonResponse({"id": imageid, "status": True})


def rem_favorite_image(request, imageid):
    imageid = int(imageid)
    img_obj = Image.objects.get(id=imageid)
    img_obj.favorite = False
    img_obj.save()
    return JsonResponse({"id": imageid, "status": False})


def rate_video(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        rating = request.POST["rating"]
        video_obj = Video.objects.filter(id=video_id).first()
        video_obj.rating = rating
        video_obj.save()
    return HttpResponse("OK")

def rem_video(request):
    if request.method == "POST":
        body = json.loads(request.body)
        video_id = body["video_id"]
        vid_obj: Video = Video.objects.filter(id=video_id).first()
        vid_obj.delete_full()
    return HttpResponse("OK")


def rem_meta(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        vid_obj: Video = Video.objects.filter(id=video_id).first()
        vid_obj.delete_entry()
    return HttpResponse("OK")


def rem_image(request):
    if request.method == "POST":
        image_id = request.POST["image_id"]
        img_obj = Image.objects.filter(id=image_id).first()
        img_obj.delete_full()
    return HttpResponse("OK")
