import json
from pathlib import Path
from typing import Generator

from django.conf import settings
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
from django.views.generic.edit import FormMixin, FormView

from viewer.video_processor import (
    generate_thumbnail,
    read_video_info,
    recognize_faces,
)

from .forms import FilterForm, LabelAddForm, LabelForm
from .models import Image, Label, Video


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
    form_class = LabelAddForm
    success_url = reverse_lazy("viewer:labels")
    model = Label

    def post(self, request, *args, **kwargs):
        form = self.form_class(request.POST)
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
        context["form"] = self.form_class
        context["form"].widget = CharField()
        return context


def delete_label(request, pk):
    if request.method == "GET":
        Label.objects.filter(id=pk).delete()
    return redirect(reverse("viewer:labels"))


def _get_videos(dir: Path) -> Generator[Path, None, None]:
    for video in dir.iterdir():
        if video.is_dir() and ".smol" not in video.parts:
            yield from _get_videos(video)
        elif (
            video.is_file()
            and video.suffix in settings.VIDEO_SUFFIXES
            and ".smol" not in video.parts
        ):
            file_path = video.relative_to(settings.MEDIA_ROOT)
            if not Video.objects.filter(path=file_path):
                print(f"Found {file_path}")
                yield file_path


def get_new_files(request) -> JsonResponse:
    file_paths = list()
    for video in _get_videos(settings.MEDIA_ROOT):
        file_paths.append(str(video))
    response = JsonResponse(
        data={"paths": file_paths, "count": len(file_paths)}
    )
    return response


@require_POST
def load_file(request, *args, **kwargs) -> JsonResponse:
    if request.method == "POST":
        body = json.loads(request.body)
        print("Processing: ", body["path"])
        path = body["path"]
        if Video.objects.filter(path=path):
            return HttpResponse("Document already imported!", status=409)
        video_path = settings.MEDIA_ROOT / path
        video_data = read_video_info(video_path)
        relative_video_path = video_path.relative_to(settings.MEDIA_ROOT)
        video_data["size"] = video_path.stat().st_size
        video_data["path"] = relative_video_path
        video_data["filename"] = video_path.name
        video_obj = Video(**video_data)
        video_obj.thumbnail = generate_thumbnail(video_obj, video_path)
        video_obj.save(force_insert=True)
        return JsonResponse(
            {
                "file": body["path"],
                "id": video_obj.id,
                "thumbnail": video_obj.thumbnail,
            }
        )


def add_video_label(request):
    if request.method == "POST":
        post_data = json.loads(request.body)
        video_id = post_data["video_id"]
        labels = post_data["labels"]
        label_objs = Label.objects.filter(id__in=labels).all()
        video_obj = Video.objects.filter(id=video_id).first()
        video_obj.labels.clear()
        [video_obj.labels.add(label_obj) for label_obj in label_objs]
        video_obj.save()
    return JsonResponse(
        {"labels": list(video_obj.labels.values("label").all())}
    )


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


class VideoView(FormMixin, generic.DetailView):
    model = Video
    template_name = "viewer/video.html"
    form_class = LabelForm

    def get_context_data(self, **kwargs):
        context = super(generic.DetailView, self).get_context_data(**kwargs)
        video = context["object"]
        context["video"] = video
        context["form"] = self.form_class(
            initial={
                "labels": video.labels.all(),
            }
        )
        context["recommendations"] = (
            Video.objects.filter(labels__in=video.labels.all())
            .exclude(id=video.id)
            .order_by("?")
            .distinct()[:50]
        )
        return context


class VideoList(generic.ListView):
    form_class = FilterForm
    template_name = "viewer/videos_page.html"
    model = Video
    paginate_by = 30
    context_object_name = "videos"
    initial = {"order_videos": 1}

    def get_queryset(self):
        order = self.request.GET.get("order_videos")
        labels = self.request.GET.getlist("label_field")
        queryset = Video.objects.all()
        if labels:
            queryset = queryset.filter(labels__in=labels)
        if order:
            queryset = queryset.order_by(order)
        print(queryset.query)
        return queryset

    def get_context_data(self, **kwargs):
        context = super(VideoList, self).get_context_data(**kwargs)
        context["form"] = self.form_class(
            initial={
                "order_videos": self.request.GET.get("order_videos", 1),
                "label_field": self.request.GET.getlist("label_field", []),
            }
        )
        return context


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
        print(context)
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


def rem_video(request):
    if request.method == "POST":
        body = json.loads(request.body)
        video_id = body["video_id"]
        vid_obj: Video = Video.objects.filter(id=video_id).first()
        vid_obj.delete_full()
    return HttpResponse("OK")


def scan_video(request):
    if request.method == "POST":
        body = json.loads(request.body)
        video_id = body["video_id"]
        video = Video.objects.filter(id=video_id).first()
        percent = recognize_faces(video)
    return HttpResponse(percent)


def delete_encoding(request):
    if request.method == "POST":
        body = json.loads(request.body)
        video_id = body["video_id"]
        video = Video.objects.filter(id=video_id).first()
        video.delete_encoding()
    return HttpResponse("OK")


def rem_meta(request):
    if request.method == "POST":
        body = json.loads(request.body)
        video_id = body["video_id"]
        vid_obj: Video = Video.objects.filter(id=video_id).first()
        vid_obj.delete_entry()
    return HttpResponse("OK")


def rem_image(request):
    if request.method == "POST":
        image_id = request.POST["image_id"]
        img_obj = Image.objects.filter(id=image_id).first()
        img_obj.delete_full()
    return HttpResponse("OK")
