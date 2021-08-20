from PIL import Image
from pathlib import Path
import base64

Image.MAX_IMAGE_PIXELS = None

def split_image(path: Path, parts: int = 100):
    images = []
    im = Image.open(path)
    imgwidth, imgheight = im.size
    crop_width = int(imgwidth / parts)
    for i in range(0, imgwidth-crop_width, crop_width):
        box = (i, 0, i+crop_width, imgheight)
        a = im.crop(box)
        a = a.convert("RGB")
        images.append(a)
    return images

def base64_encode(string: str):
    string_bytes = string.encode("utf-8")
    base64_bytes = base64.b64encode(string_bytes)
    base64_string = base64_bytes.decode("utf-8")
    return base64_string

def base64_decode(string: str):
    string_bytes = string.encode("utf-8")
    base64_bytes = base64.b64decode(string_bytes)
    string_data = base64_bytes.decode("utf-8")
    return string_data