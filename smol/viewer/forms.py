from django import forms
from .models import Person, Video, Label


class FilterForm(forms.Form):
    FILTERS = [
        ("", "Select Order"),
        ("-favorite", "favorites"),
        ("dim_width", "resolution asc"),
        ("-dim_width", "resolution desc"),
        ("-inserted_at", "newest"),
        ("inserted_at", "oldest"),
        ("duration", "shortest"),
        ("-duration", "longest"),
    ]
    labels = Label.objects.all()
    order_videos = forms.ChoiceField(choices=FILTERS, required=False, initial=0)
    label_field = forms.ModelMultipleChoiceField(
        queryset=labels, required=False
    )

    # def __init__(self, *args, **kwargs):
    #     super(FilterForm, self).__init__(*args, **kwargs)
    #     print("FORM: %s", dir(self))
    #     self.declared_fields['labels'].widget.attrs['class'] = 'form-control'


class LabelForm(forms.Form):
    labels = forms.ModelMultipleChoiceField(queryset=Label.objects.all())

class LabelAddForm(forms.Form):
    labels = forms.CharField()


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
            "age",
            "labels",
            "videos",
            "avatar",
        )
