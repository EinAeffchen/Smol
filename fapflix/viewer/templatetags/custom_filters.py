from django import template
from datetime import timedelta

register = template.Library()

@register.filter
def rem_slashes(value):
    return value.replace("/", "")

@register.filter
def get_type(value):
    return value.split(".")[-1]

@register.filter
def human_duration(value):
    return str(timedelta(seconds=round(value)))

@register.filter
def hours(value):
    if value:
        return value//3600
    else:
        return ""

@register.filter
def minutes(value):
    if value:
        return value//60%60
    else:
        return ""