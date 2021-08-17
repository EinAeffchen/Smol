from django import forms
from .models import Actors, Videos
from django.views.generic.edit import UpdateView

class FilterForm(forms.Form):
    FILTERS = [
        ('rating', 'rating'),
        ('favorite', 'favorites'),
        ('dim_width', 'resolution'),
        ('inserted_at', 'newest'),
        ('duration', 'longest'),
    ]
    filter_videos = forms.ChoiceField(choices=FILTERS)

class LabelForm(forms.Form):
    label = forms.CharField(label="Label", max_length=100)

class ImageForm(forms.ModelForm):
    """Form for the image model"""
    class Meta:
        model = Actors
        fields = ('avatar',)

class DeleteActorForm(forms.ModelForm):
    class Meta:
        model = Actors
        fields = ("id",)

class ActorForm(forms.ModelForm):
    """Form for the image model"""
    class Meta:
        model = Actors
        fields = ('forename','surname','birth_year', 'nationality','labels','videos','images','avatar')