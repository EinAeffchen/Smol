from django.contrib import admin
from .models import Actors, Videos, Labels

# Register your models here.
admin.site.register(Labels)
admin.site.register(Actors)
admin.site.register(Videos)
