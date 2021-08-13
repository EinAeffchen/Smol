from django.contrib import admin
from .models import Videos, Labels

# Register your models here.
admin.site.register(Labels)
admin.site.register(Videos)
