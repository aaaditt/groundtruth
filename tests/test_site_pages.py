"""The static site's structure: one shared menu on every page, the tour on the front door,
and the hard rule that page scripts never put data into the page with innerHTML."""
import os
import re

import pytest

SITE = os.path.join(os.path.dirname(__file__), "..", "site")
NAV = ["globe.html#ask", "globe.html", "today.html", "game.html", "research.html", "about.html"]
PAGES = ["index.html", "watch.html"] + NAV[1:]


def read(name):
    with open(os.path.join(SITE, name), encoding="utf-8") as f:
        return f.read()


@pytest.mark.parametrize("page", NAV[1:])
def test_every_page_has_the_same_menu(page):
    html = read(page)
    nav = re.search(r'<nav aria-label="Site">(.*?)</nav>', html, re.S)
    assert nav, f"{page} has no site menu"
    assert re.findall(r'href="([^"]+)"', nav.group(1)) == NAV
    # the page you are on is marked, and only that one
    assert re.findall(r'href="([^"]+)" aria-current="page"', nav.group(1)) == [page]
    assert 'href="index.html#day"' in html          # replay the tour from anywhere


@pytest.mark.parametrize("page", PAGES)
def test_every_page_loads_sound_and_the_new_fonts(page):
    html = read(page)
    assert '<script src="sound.js"></script>' in html
    assert "family=Gloock" in html and "family=Schibsted+Grotesk" in html
    assert "Old+Standard" not in html and "Libre+Franklin" not in html
    assert 'id="sound"' in html                      # the on/off switch is in every bar


def test_front_door_is_the_tour_with_a_skip():
    html = read("index.html")
    for stop in ["welcome", "day", "quiet", "learn", "yours"]:
        assert f'id="{stop}"' in html
    assert 'id="skip"' in html and 'href="globe.html"' in html
    assert '<script src="tour.js"></script>' in html


def test_scripts_never_use_innerhtml():
    for name in os.listdir(SITE):
        if name.endswith(".js"):
            assert not re.search(r"\.(inner|outer)HTML\s*[+]?=|insertAdjacentHTML", read(name)), f"{name} writes HTML"


def test_page_scripts_keep_the_cache_busting_pattern():
    # .github/workflows/pulse.yml stamps src="name.js" with ?v=<sha> only for lowercase names
    for name in os.listdir(SITE):
        if name.endswith(".html"):
            for src in re.findall(r'<script src="([^"]+)"', read(name)):
                if not src.startswith("http"):
                    assert re.fullmatch(r"[a-z]+\.js", src), f"{name}: {src}"


def test_watch_page_media_exists_and_matches_the_captions():
    import json
    html = read("watch.html")
    for ref in re.findall(r'(?:src|poster|href)="(media/[^"]+)"', html):
        assert os.path.exists(os.path.join(SITE, ref)), f"watch.html points at missing {ref}"
    with open(os.path.join(SITE, "media", "chapters.json"), encoding="utf-8") as f:
        chapters = json.load(f)
    with open(os.path.join(SITE, "..", "video", "captions.json"), encoding="utf-8") as f:
        scenes = json.load(f)["scenes"]
    # the video was assembled from the current captions file (re-run video/assemble.py if this fails)
    assert [c["title"] for c in chapters] == [s["chapter"] for s in scenes]
    assert [c["start"] for c in chapters] == sorted(c["start"] for c in chapters)


def test_readme_images_and_licence_exist():
    root = os.path.join(SITE, "..")
    with open(os.path.join(root, "README.md"), encoding="utf-8") as f:
        readme = f.read()
    for ref in re.findall(r'(?:src="|\]\()((?:assets|site/media|outputs/plots)/[^")]+)', readme):
        assert os.path.exists(os.path.join(root, ref)), f"README points at missing {ref}"
    with open(os.path.join(root, "LICENSE"), encoding="utf-8") as f:
        assert f.readline().strip() == "MIT License"
