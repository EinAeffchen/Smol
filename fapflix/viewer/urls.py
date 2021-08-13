from django.urls import path

from . import views

urlpatterns = [
    path("", views.IndexView.as_view(), name="index"),
    path("addVideoLabel/", views.add_video_label, name="label-video-add"),
    path("deleteVideoLabel/", views.delete_video_label, name="label-video-delete"),
    path("fav/<int:videoid>", views.add_favorite, name="add_favorites"),
    path("label/<int:pk>/", views.LabelResultView.as_view(), name="label-result-view"),
    path("label/<int:pk>/delete/", views.delete_label, name="label-delete"),
    path("labels/", views.LabelView.as_view(), name="labels"),
    path("load/", views.DataLoader.as_view(), name="load"),
    path("loadData/", views.load_data, name="load-data"),
    path("rateVideo/", views.rate_video, name="rate-video"),
    path("remfav/<int:videoid>", views.rem_favorite, name="rem_favorites"),
    path("remvid/<int:videoid>", views.rem_video, name="rem_video"),
    path("search/", views.SearchView.as_view(), name="search"),
    path("video/<int:pk>/", views.VideoView.as_view(), name="video"),
]
