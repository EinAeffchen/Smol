from django.db import IntegrityError
from django.db.models import Q
from django.db.models.fields import CharField, IntegerField
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from django.shortcuts import render, redirect
from django.views import generic
from django.views.generic.edit import FormView
from django.urls import reverse_lazy, reverse
from .forms import FilterForm, LabelForm
from .models import Labels, Videos
from pathlib import Path
from .video_processor import process_videos
from django.conf.urls.static import static


class IndexView(generic.ListView):
    template_name = "viewer/index.html"
    model = Videos

    def get_queryset(self):
        videos = Videos.objects.filter().order_by("-rating")[:18]
        return videos

    def get_context_data(self, **kwargs):
        # Call the base implementation first to get a context
        context = super().get_context_data(**kwargs)
        # Add in a QuerySet of all the videos
        context["result_videos1"] = Videos.objects.order_by("-rating")[:30]
        context["result_videos2"] = Videos.objects.order_by("-inserted_at")[:30]
        context["result_videos3"] = Videos.objects.filter(favorite=True).order_by(
            "-favorite"
        )[:30]
        return context


class LabelView(FormView, generic.ListView):
    template_name = "viewer/labels.html"
    form_class = LabelForm
    success_url = reverse_lazy("viewer:labels")
    model = Labels

    def post(self, request, *args, **kwargs):
        form = LabelForm(request.POST)
        context = dict()
        if form.is_valid():
            try:
                label = request.POST["label"].lower()
                label_obj = Labels(label=label)
                label_obj.save()
            except IntegrityError:
                context["error"] = f"Label {label} already exists!"
        labels = Labels.objects.all()[:20]
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


class DataLoader(generic.ListView):
    template_name = "viewer/loader.html"
    model = Videos

    def get_context_data(self, **kwargs):
        context = super(DataLoader, self).get_context_data(**kwargs)
        context["video_count"] = self.get_queryset().count()
        context["image_count"] = 0
        return context


class VideoView(generic.DetailView):
    model = Videos
    template_name = "viewer/video.html"

    def get_context_data(self, **kwargs):
        context = super(generic.DetailView, self).get_context_data(**kwargs)
        video = context["object"]
        context["labels"] = Labels.objects.all()
        context["video"] = video
        context["recommendations"] = Videos.objects.filter(
            labels__in=video.labels.all()
        )
        return context


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


class SearchView(VideoList):
    def get_queryset(self):
        search_query = self.request.GET["query"]
        title = Videos.objects.filter()
        return title

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["search"] = self.request.GET["query"]
        return context


def load_data(request):
    path = Path(__file__).resolve().parent
    path = path / "static/viewer/images"
    thumbnail_dir = path / "thumbnails"
    preview_dir = path / "previews"
    if not thumbnail_dir.is_dir():
        thumbnail_dir.mkdir()
    if not preview_dir.is_dir():
        preview_dir.mkdir()
    last = process_videos(thumbnail_dir, preview_dir)
    return JsonResponse(last)


def add_favorite(request, videoid):
    vid_obj = Videos.objects.get(id=videoid)
    vid_obj.favorite = True
    vid_obj.save()
    return JsonResponse({"id": videoid, "status": True})


def rem_favorite(request, videoid):
    vid_obj = Videos.objects.get(id=videoid)
    vid_obj.favorite = False
    vid_obj.save()
    return JsonResponse({"id": videoid, "status": False})


def rate_video(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        rating = request.POST["rating"]
        video_obj = Videos.objects.filter(id=video_id).first()
        video_obj.rating = rating
        video_obj.save()
    return HttpResponse("OK")


def rem_video(request, videoid):
    vid_obj = Videos.objects.filter(id=videoid).first()
    obj = Path(vid_obj.path)
    try:
        obj.unlink()
    except PermissionError:
        print("Couldn't delete, file busy.")
    vid_obj.delete()
    return redirect(reverse("viewer:index"))
