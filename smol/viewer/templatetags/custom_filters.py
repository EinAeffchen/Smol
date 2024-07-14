from django import template
from datetime import timedelta
from urllib.parse import quote
from pathlib import Path

register = template.Library()


@register.filter
def rem_slashes(value):
    return value.replace("/", "")


@register.filter
def order_filter(value, order):
    return value.order_by(order)


@register.filter
def get_type(value):
    return value.split(".")[-1]


@register.filter
def human_duration(value):
    return str(timedelta(seconds=round(value)))


@register.filter
def hours(value):
    if value:
        return value // 3600
    else:
        return ""


@register.filter
def minutes(value):
    if value:
        return value // 60 % 60
    else:
        return ""


@register.filter
def urlencode(value):
    return quote(value)


@register.filter
def connect(first, second):
    return str(first) + str(second)


@register.filter
def to_duration(value_in_seconds):
    minutes = value_in_seconds / 60
    seconds = value_in_seconds % 60
    return f"{int(minutes):02d}:{int(seconds):02d}"


@register.filter
def get_type(value):
    mime_mapping = {
        ".avi": "video/x-msvideo",
        ".mp4": "video/mp4",
        ".mpeg": "video/mpeg",
        ".mpkg": "application/vnd.apple.installer+xml",
        ".ts": "video/mp2t",
        ".wav": "audio/wav",
        ".webm": "video/webm",
        ".3gp": "video/3gpp",
        ".mkv": "video/webm",
    }
    extension = Path(value).suffix
    return mime_mapping.get(extension, "video/mp4")
