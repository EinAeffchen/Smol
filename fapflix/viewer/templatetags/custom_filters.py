from django import template

register = template.Library()

@register.filter
def rem_slashes(value):
    return value.replace("/", "")

@register.filter
def get_type(value):
    return value.split(".")[-1]