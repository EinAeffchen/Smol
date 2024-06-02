from django.urls import path

from . import views

urlpatterns = [
    path("", views.IndexView.as_view(), name="index"),
    path("addVideoLabel/", views.add_video_label, name="label-video-add"),
    path("changeAge/", views.change_age, name="change-age"),
    path(
        "deleteVideoLabel/",
        views.delete_video_label,
        name="label-video-delete",
    ),
    path("fav/<int:videoid>/", views.add_favorite, name="add_favorites"),
    path(
        "fav_image/<int:imageid>/",
        views.add_favorite_image,
        name="add_favorite_image",
    ),
    path(
        "label/<int:pk>/",
        views.LabelResultView.as_view(),
        name="label-result-view",
    ),
    path("label/<int:pk>/delete/", views.delete_label, name="label-delete"),
    path("labels/", views.LabelView.as_view(), name="labels"),
    path("load/", views.DataLoader.as_view(), name="load"),
    path("loadData/", views.load_data, name="load-data"),
    path("cleanData/", views.clean_data, name="clean-data"),
    path("rateVideo/", views.rate_video, name="rate-video"),
    path("remfav/<int:videoid>/", views.rem_favorite, name="rem_favorites"),
    path(
        "remfav_image/<int:imageid>/",
        views.rem_favorite_image,
        name="rem_favorite_image",
    ),
    path("remvid/", views.rem_video, name="rem_video"),
    path("remmeta/", views.rem_meta, name="rem_video_meta"),
    path("remimage/", views.rem_image, name="rem-image"),
    path("search/", views.SearchView.as_view(), name="search"),
    path("video/<int:pk>/", views.VideoView.as_view(), name="video"),
    path(
        "videoOverview/", views.VideoOverview.as_view(), name="video-overview"
    ),
    path(
        "imageOverview/", views.ImageOverview.as_view(), name="image-overview"
    )
]
