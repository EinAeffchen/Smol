from django import forms
from .models import Person, Video
from django.views.generic.edit import UpdateView


class FilterForm(forms.Form):
    FILTERS = [
        ("rating", "rating"),
        ("favorite", "favorites"),
        ("dim_width", "resolution"),
        ("inserted_at", "newest"),
        ("duration", "longest"),
    ]
    filter_videos = forms.ChoiceField(choices=FILTERS)


class LabelForm(forms.Form):
    labels = forms.CharField(label="Label")


class ImageForm(forms.ModelForm):
    """Form for the image model"""

    class Meta:
        model = Person
        fields = ("avatar",)


class DeletePersonForm(forms.ModelForm):
    class Meta:
        model = Person
        fields = ("id",)


class OrderedModelMultipleChoiceField(forms.ModelMultipleChoiceField):
    def clean(self, value):
        qs = super(OrderedModelMultipleChoiceField, self).clean(value)
        return qs


class PersonForm(forms.ModelForm):
    """Form for the image model"""

    videos = OrderedModelMultipleChoiceField(
        Video.objects.order_by("filename")
    )

    class Meta:
        model = Person
        fields = (
            "forename",
            "surname",
            "birth_year",
            "nationality",
            "labels",
            "videos",
            "images",
            "avatar",
        )
