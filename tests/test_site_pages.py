"""The static site's structure: one shared menu on every page, the tour on the front door,
and the hard rule that page scripts never put data into the page with innerHTML."""
import os
import re

import pytest

SITE = os.path.join(os.path.dirname(__file__), "..", "site")
NAV = ["today.html", "globe.html", "game.html", "research.html", "about.html"]


def read(name):
    with open(os.path.join(SITE, name), encoding="utf-8") as f:
        return f.read()


@pytest.mark.parametrize("page", NAV)
def test_every_page_has_the_same_menu(page):
    html = read(page)
    nav = re.search(r'<nav aria-label="Site">(.*?)</nav>', html, re.S)
    assert nav, f"{page} has no site menu"
    assert re.findall(r'href="([^"]+)"', nav.group(1)) == NAV
    # the page you are on is marked, and only that one
    assert re.findall(r'href="([^"]+)" aria-current="page"', nav.group(1)) == [page]
    assert 'href="index.html#day"' in html          # replay the tour from anywhere


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
