import random
from datetime import datetime
from pathlib import Path

from django.core.files import File
from django.db import IntegrityError
from django.db.models import Count, Q
from django.db.models.fields import CharField
from django.http import (
    HttpResponse,
    HttpResponseBadRequest,
    JsonResponse,
    HttpResponseRedirect,
)
from django.shortcuts import redirect, render
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.views.generic.edit import (
    FormView,
)

from asgiref.sync import sync_to_async
from .forms import PersonForm, FilterForm, ImageForm, LabelForm
from .models import Video, Label, Person, Image
from django.conf import settings
from .video_processor import (
    generate_previews_thumbnails,
)


class IndexView(generic.ListView):
    template_name = "viewer/index.html"
    model = Video

    def get_context_data(self, **kwargs):
        # Call the base implementation first to get a context
        context = super().get_context_data(**kwargs)

        context["result_videos1"] = Video.objects.all()[:60]
        context["result_videos2"] = Video.objects.order_by("-inserted_at")[:30]
        context["result_videos3"] = Video.objects.order_by("-rating")[:30]

        if not self.request.GET:
            context["label_videos"] = dict()
            active_labels = [
                (label.id, label.label)
                for label in Label.objects.annotate(video_count=Count("video"))
                .filter(video__isnull=False)
                .filter(video_count__gte=6)
                .distinct()
            ]
            if len(active_labels) >= 5:
                label_lists = random.sample(active_labels, 5)
                for label in label_lists:
                    context["label_videos"][label[1]] = Video.objects.filter(
                        labels=label[0]
                    )[:60]
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
                label = request.POST["label"].lower()
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
        context["form"] = LabelForm()
        context["form"].widget = CharField()
        return context


def delete_label(request, pk):
    if request.method == "GET":
        Label.objects.filter(id=pk).delete()
    return redirect(reverse("viewer:labels"))


def add_video_label(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        label_id = request.POST["label_id"]
        label_obj = Label.objects.filter(id=label_id).first()
        video_obj = Video.objects.filter(id=video_id).first()
        if label_obj in video_obj.labels.all():
            return HttpResponseBadRequest("Label already added!")
        video_obj.labels.add(label_obj)
        video_obj.save()
    return JsonResponse({"label": label_obj.label, "label_id": label_obj.id})


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
        context["labels"] = Label.objects.all().order_by("label")
        context["video"] = video
        context["recommendations"] = (
            Video.objects.filter(labels__in=video.labels.all())
            .exclude(id=video.id)
            .distinct()
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


class ImageOverview(generic.ListView):
    paginate_by = 16
    model = Image
    template_name = "viewer/overview_images.html"
    ordering = ["-favorite", "-inserted_at"]


class SearchView(VideoList):
    template_name = "viewer/search.html"

    def get_queryset(self):
        search_query = self.request.GET["query"]
        title = Video.objects.filter(labels__label__in=search_query)
        return title

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        search_query = self.request.GET["query"]
        context["videos"] = Video.objects.filter(
            filename__icontains=search_query
        )
        context["images"] = Image.objects.filter(
            filename__icontains=search_query
        )
        context["labels"] = Video.objects.filter(
            labels__label__icontains=search_query
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
        context["result_videos1"] = Video.objects.filter(
            labels=label_obj
        ).order_by("-rating")[:30]
        context["result_videos2"] = Video.objects.filter(
            labels=label_obj
        ).order_by("-inserted_at")[:30]
        context["result_videos3"] = Video.objects.filter(
            labels=label_obj
        ).order_by("-favorite")[:30]
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


def rate_video(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        rating = request.POST["rating"]
        video_obj = Video.objects.filter(id=video_id).first()
        video_obj.rating = rating
        video_obj.save()
    return HttpResponse("OK")


def change_age(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
        age = request.POST["age"]
        video_obj = Video.objects.filter(id=video_id).first()
        video_obj.person_age = age
        video_obj.save()
    return HttpResponse("OK")


def rem_video(request):
    if request.method == "POST":
        video_id = request.POST["video_id"]
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
