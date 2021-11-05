from django.urls import path

from . import views

urlpatterns = [
    path("", views.IndexView.as_view(), name="index"),
    path("actor_edit/<int:pk>/", views.EditActorView.as_view(), name="edit-actor"),
    path(
        "actor_delete/<int:pk>/", views.DeleteActorView.as_view(), name="delete-actor"
    ),
    path("actor/<int:pk>/", views.ActorView.as_view(), name="actor"),
    path("update-actor/", views.updateActor, name="actor-add-content"),
    path("removeActorVideo/", views.actor_remove_video, name="actor-video-delete"),
    path("removeActorImage/", views.actor_remove_image, name="actor-image-delete"),
    path("actors/", views.ActorsView.as_view(), name="actors"),
    path("addVideoLabel/", views.add_video_label, name="label-video-add"),
    path("changeAge/", views.change_age, name="change-age"),
    path("deleteActorLabel/", views.delete_actor_label, name="label-actor-delete"),
    path("deleteVideoLabel/", views.delete_video_label, name="label-video-delete"),
    path("fav/<int:videoid>/", views.add_favorite, name="add_favorites"),
    path(
        "fav_image/<int:imageid>/", views.add_favorite_image, name="add_favorite_image"
    ),
    path("generate_actor/", views.CreateActorView.as_view(), name="generate-actor"),
    path("label/<int:pk>/", views.LabelResultView.as_view(), name="label-result-view"),
    path("label/<int:pk>/delete/", views.delete_label, name="label-delete"),
    path("labels/", views.LabelView.as_view(), name="labels"),
    path("load/", views.DataLoader.as_view(), name="load"),
    path("loadData/", views.load_data, name="load-data"),
    path("cleanData/", views.clean_data, name="clean-data"),
    path("loadPostVideo/", views.post_process_video_controller, name="load-post-video"),
    path("loadPostImage/", views.post_process_image_controller, name="load-post-image"),
    path("new_actor/", views.add_actor, name="new-actor"),
    path("rateVideo/", views.rate_video, name="rate-video"),
    path("remfav/<int:videoid>/", views.rem_favorite, name="rem_favorites"),
    path(
        "remfav_image/<int:imageid>/",
        views.rem_favorite_image,
        name="rem_favorite_image",
    ),
    path("remvid/", views.rem_video, name="rem_video"),
    path("remimage/", views.rem_image, name="rem-image"),
    path("search/", views.SearchView.as_view(), name="search"),
    path("video/<int:pk>/", views.VideoView.as_view(), name="video"),
    path("videoOverview/", views.VideoOverview.as_view(), name="video-overview"),
    path("imageOverview/", views.ImageOverview.as_view(), name="image-overview"),
]
