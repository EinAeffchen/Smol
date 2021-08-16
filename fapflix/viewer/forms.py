from django import forms
from .models import Videos

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
