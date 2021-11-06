from django.contrib import admin
from .models import Person, Video, Label

# Register your models here.
admin.site.register(Label)
admin.site.register(Person)
admin.site.register(Video)
