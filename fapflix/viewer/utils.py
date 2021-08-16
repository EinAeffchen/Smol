from PIL import Image
from pathlib import Path


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
