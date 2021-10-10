import sys
from parsel import Selector
import subprocess
import requests
from pathlib import Path

if __name__ == "__main__":
    url = sys.argv[1]
    print(f"Processing {url}")
    path = Path()
    if not ".m3u8" in url:
        res = requests.get(url)
        req = Selector(res.text)
        m3u8 = req.xpath("//video/source/@src").get()
        url = req.xpath("//meta[@property='og:url']/@content").get()
        filename = path / f"{url.split('/')[-1]}.mp4"
        print(f"Downloading {m3u8}...")
    else:
        m3u8 = url
        filename = path / f"{url.split('/')[-2]}.mp4"
    print(subprocess.check_output(
        [
            "ffmpeg",
            "-i",
            str(m3u8),
            "-c",
            "copy",
            str(filename),
        ]
    ))
    print(f"Saved as {filename}!")
