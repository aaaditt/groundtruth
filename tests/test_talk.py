"""The talk deck (site/talk/, docs/21): its slides file is complete and honest.

slides.json is the one source for the live deck and the PowerPoint, so these checks guard
both: every clip and still it names exists, every live slide has a fallback, every chart
it names is drawn by talk.js, the order matches the script, and no static slide's
headline carries a typed-in number (numbers come from data/*.json)."""
import json
import os
import re

import pytest

REPO = os.path.join(os.path.dirname(__file__), "..")
TALK = os.path.join(REPO, "site", "talk")


@pytest.fixture(scope="module")
def deck():
    with open(os.path.join(TALK, "slides.json"), encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def talk_js():
    with open(os.path.join(TALK, "talk.js"), encoding="utf-8") as f:
        return f.read()


def test_beats_are_unique_and_complete(deck):
    ids = [b["id"] for b in deck["beats"]]
    assert len(ids) == len(set(ids))
    for b in deck["beats"]:
        assert b["kind"] in ("static", "video", "live"), b["id"]
        assert b[b["kind"]], b["id"]
        assert b["title"] and b["speaker"] and b["notes"], b["id"]


def test_every_clip_and_still_exists(deck):
    for b in deck["beats"]:
        clips = [b["video"]["clip"]] if b["kind"] == "video" else []
        fb = (b.get("live") or {}).get("fallback", {})
        clips += [fb["clip"]] if "clip" in fb else []
        for c in clips:
            for ext in ("mp4", "jpg"):
                assert os.path.exists(os.path.join(TALK, "media", f"{c}.{ext}")), f"{b['id']}: media/{c}.{ext}"
        if "still" in fb:
            assert os.path.exists(os.path.join(TALK, "media", f"{fb['still']}.png")), b["id"]


def test_every_live_slide_has_a_fallback_and_a_ready_check(deck):
    for b in deck["beats"]:
        if b["kind"] == "live":
            live = b["live"]
            assert live["fallback"].get("clip") or live["fallback"].get("still"), b["id"]
            assert live["ready"], b["id"]
            assert "embed=1" in live["src"], f"{b['id']}: live pages must open silent, without the site bar"
            for st in live.get("steps", []):
                assert "embed=1" in st["src"] and st["ready"], b["id"]
                # a step must change the query string, so the page really reloads
                assert st["src"].split("#")[0] != live["src"].split("#")[0], b["id"]


def test_every_chart_is_drawn(deck, talk_js):
    drawn = set(re.findall(r"^  (\w+)\(b?\) \{", talk_js, re.M))
    for b in deck["beats"]:
        names = [b["static"]["chart"]] if b["kind"] == "static" else []
        names += [b["video"]["then"]] if b["kind"] == "video" and b["video"].get("then") else []
        for n in names:
            assert n in drawn, f"{b['id']}: chart {n!r} is not in talk.js"


def test_static_headlines_carry_no_typed_numbers(deck):
    for b in deck["beats"]:
        if b["kind"] == "static":
            assert not re.search(r"\d", b["title"]), f"{b['id']}: {b['title']!r} (numbers come from the data)"


def test_order_matches_the_script(deck):
    """The beats appear in docs/21's table in the same order (backups excluded)."""
    with open(os.path.join(REPO, "docs", "21-story-presentation-script.md"), encoding="utf-8") as f:
        script = f.read()
    rows = re.findall(r"^\| (\d+) \| ([^|]+) \|", script, re.M)
    main = [b for b in deck["beats"] if not b.get("backup")]
    assert len(rows) == len(main), "docs/21 table and slides.json have different numbers of beats"


def test_deck_scripts_never_use_innerhtml(talk_js):
    assert not re.search(r"\.(inner|outer)HTML\s*[+]?=|insertAdjacentHTML", talk_js)


def test_deck_runs_offline(deck):
    """No CDN in the deck shell: fonts are local files, so static and clip slides work
    without the internet (only live slides need it)."""
    with open(os.path.join(TALK, "index.html"), encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(TALK, "talk.css"), encoding="utf-8") as f:
        css = f.read()
    assert "http" not in re.sub(r'href="data:[^"]*"', "", html)
    for font in re.findall(r"url\((fonts/[^)]+)\)", css):
        assert os.path.exists(os.path.join(TALK, font)), font


def test_stops_are_ordered_and_every_hold_exists(deck):
    """media/cues.json (src/talk_build.py): each clip's stops come in order, inside the
    clip, and every living hold it names has its loop file. Only the last stop can be final."""
    with open(os.path.join(TALK, "media", "cues.json"), encoding="utf-8") as f:
        cues = json.load(f)
    played = {b["video"]["clip"] for b in deck["beats"] if b["kind"] == "video"}
    assert set(cues) <= played
    for clip, stops in cues.items():
        ats = [q["at"] for q in stops]
        assert ats == sorted(ats) and ats[0] > 0, clip
        assert not any(q["final"] for q in stops[:-1]), clip
        for q in stops:
            if q["hold"]:
                assert os.path.exists(os.path.join(TALK, "media", q["hold"])), f"{clip}: {q['hold']}"


def test_stops_come_from_the_clips_own_list():
    """The deck's stops are the renderer's (presentation/video/src/cues.json), moved by the cut."""
    with open(os.path.join(REPO, "presentation", "video", "src", "cues.json"), encoding="utf-8") as f:
        spec = json.load(f)["clips"]
    with open(os.path.join(TALK, "media", "cues.json"), encoding="utf-8") as f:
        cues = json.load(f)
    with open(os.path.join(TALK, "slides.json"), encoding="utf-8") as f:
        start = {b["video"]["clip"]: b["video"].get("start") or 0 for b in json.load(f)["beats"] if b["kind"] == "video"}
    for clip, stops in cues.items():
        src = {round(q["at"] - start[clip], 3): q["hold"] for q in spec[clip]}
        for q in stops:
            assert q["at"] in src, clip
            assert bool(q["hold"]) == src[q["at"]], clip


def test_every_building_diagram_has_a_group_per_step(deck, talk_js):
    """A still with "steps": n builds in n presses, so its chart must draw groups 0..n."""
    for b in deck["beats"]:
        n = b["kind"] == "static" and b["static"].get("steps")
        if not n:
            continue
        body = talk_js[talk_js.index(f"  {b['static']['chart']}(b) {{"):]
        body = body[:body.index("\n  },")]
        for k in range(n + 1):
            assert f"stepGroup(svg, {k})" in body, f"{b['id']}: no group for step {k}"
