"""Capture the README screenshots from the live site (1440x900, light theme).

Usage: python scripts/screenshots.py [--url https://groundtruth-seismic.vercel.app]
Writes assets/screenshot-{tour,day,quiet,globe,today,research}.png.
Needs: Playwright for Python with Chromium (pip install playwright; playwright install chromium).
"""

import argparse
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ASSETS = Path(__file__).resolve().parents[1] / "assets"
# the globes are WebGL: use the GPU on Windows (ANGLE/D3D11); software rendering elsewhere
GPU = (["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] if os.name == "nt"
       else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://groundtruth-seismic.vercel.app")
    url = ap.parse_args().url.rstrip("/") + "/"
    ASSETS.mkdir(exist_ok=True)

    def shot(page, name):
        page.screenshot(path=str(ASSETS / f"screenshot-{name}.png"))

    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=GPU)
        page = browser.new_page(viewport={"width": 1440, "height": 900}, color_scheme="light")

        page.goto(url + "index.html", wait_until="networkidle")
        page.wait_for_timeout(4500)                                  # the pen line draws in
        shot(page, "tour")
        page.evaluate("""(() => { const e = document.querySelector('[data-sun]');
            scrollTo(0, e.getBoundingClientRect().top + scrollY - innerHeight * 0.45); })()""")
        page.wait_for_timeout(1500)
        shot(page, "day")
        page.evaluate("""(() => { const r = document.getElementById('run');
            scrollTo(0, r.offsetTop + (r.offsetHeight - innerHeight) * 0.55); })()""")
        page.wait_for_timeout(5000)                                  # the globe builds on arrival
        shot(page, "quiet")

        page.goto(url + "globe.html#2020-03-30/BE.UCC..HHZ", wait_until="networkidle")
        page.wait_for_function("() => typeof map !== 'undefined' && map && map.loaded()", timeout=60000)
        page.wait_for_timeout(6000)
        shot(page, "globe")

        page.goto(url + "today.html", wait_until="networkidle")
        page.wait_for_selector("#rows .row")
        page.wait_for_timeout(1500)
        shot(page, "today")

        page.goto(url + "research.html", wait_until="networkidle")
        page.wait_for_timeout(3500)
        shot(page, "research")
        browser.close()
    print("assets/screenshot-{tour,day,quiet,globe,today,research}.png")


if __name__ == "__main__":
    main()
