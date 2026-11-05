"""Record a short walk through the live site and convert it to assets/demo.gif for the README.

The path: the tour's welcome, one day under Brussels, then Ask the ground on Christmas Day
2019 in Brussels (the Earth flies in, the day draws, it reads like a Sunday), then the globe
playing through March 2020.

Usage: python scripts/record_demo.py [--url https://groundtruth-seismic.vercel.app]
Needs: Playwright for Python with Chromium, and ffmpeg on PATH.
"""

import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "demo.gif"
SIZE = {"width": 1280, "height": 800}
# the globes are WebGL: use the GPU on Windows (ANGLE/D3D11); software rendering elsewhere
GPU = (["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] if os.name == "nt"
       else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])

# an eased window scroll, so the scroll-driven tour reads smoothly on video
GLIDE = """([y, ms]) => new Promise(done => {
  const from = scrollY, t0 = performance.now(), ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  (function step(now) { const k = Math.min(1, (now - t0) / ms); scrollTo(0, from + (y - from) * ease(k));
    if (k < 1) requestAnimationFrame(step); else done(); })(t0); })"""

AT_WAKE = "(() => { const e = document.getElementById('s-wake'); return e.getBoundingClientRect().top + scrollY - innerHeight * .5; })()"
AT_SUN = "(() => { const e = document.querySelector('[data-sun]'); return e.getBoundingClientRect().top + scrollY - innerHeight * .45; })()"
RUN = "(() => { const r = document.getElementById('run'); return [r.offsetTop, r.offsetTop + r.offsetHeight - innerHeight]; })()"


def record(url, video_dir):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=GPU)
        ctx = browser.new_context(viewport=SIZE, record_video_dir=str(video_dir), record_video_size=SIZE,
                                  color_scheme="dark")
        page = ctx.new_page()
        page.goto(url + "index.html", wait_until="networkidle")
        page.wait_for_timeout(4200)                                       # globe turns, the pen draws the day
        page.evaluate(GLIDE, [page.evaluate("document.getElementById('day').offsetTop"), 1400])
        page.evaluate(GLIDE, [page.evaluate(AT_WAKE), 3200])
        page.wait_for_timeout(700)
        page.evaluate(GLIDE, [page.evaluate(AT_SUN), 2400])
        page.wait_for_timeout(1400)                                       # the Sunday line appears
        page.goto(url + "globe.html", wait_until="networkidle")
        page.wait_for_function("() => typeof map !== 'undefined' && map && map.loaded() && typeof openAsk === 'function'", timeout=60000)
        page.wait_for_timeout(800)
        page.evaluate("openAsk('BE.UCC..HHZ', '2019-12-25')")             # Ask: Christmas Day 2019
        page.wait_for_timeout(6500)
        page.evaluate("closeAsk(); setDate(indexOf('2020-03-02'))")
        page.wait_for_timeout(1200)
        page.click("#play")                                               # March 2020, day by day
        page.wait_for_timeout(3600)
        page.click("#play")
        page.wait_for_timeout(800)
        video = page.video.path()
        ctx.close()
        browser.close()
    return Path(video)


def to_gif(src, fps, width, colors):
    palette = src.with_suffix(".png")
    flt = f"fps={fps},scale={width}:-1:flags=lanczos"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.2", "-i", str(src),
                    "-vf", f"{flt},palettegen=max_colors={colors}:stats_mode=diff", str(palette)], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.2", "-i", str(src), "-i", str(palette),
                    "-lavfi", f"{flt}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
                    str(OUT)], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://groundtruth-seismic.vercel.app")
    args = ap.parse_args()
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is not on PATH")
    OUT.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        video = record(args.url.rstrip("/") + "/", Path(tmp))
        # satellite imagery makes GIFs heavy: step down frame rate, width and palette until it fits
        for fps, width, colors in ((12, 960, 256), (10, 900, 192), (10, 800, 128), (8, 800, 128), (8, 720, 96), (8, 640, 96), (6, 720, 96)):
            to_gif(video, fps, width, colors)
            size = OUT.stat().st_size
            print(f"assets/demo.gif  {fps} fps  {width}px  {colors} colours  {size / 1e6:.1f} MB")
            if size <= 8_000_000:
                break
        else:
            raise SystemExit("GIF is still over 8 MB; shorten the path")


if __name__ == "__main__":
    main()
