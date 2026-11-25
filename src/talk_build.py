"""
talk_build.py -- gather everything the live talk deck (site/talk/) needs, so it runs from
the website with no build step and no internet for its own slides.

Reads site/talk/slides.json (the one source for both decks) and writes:
  site/talk/data/*.json     the numbers, copied from presentation/video/public/data/
                            (written by src/presentation_data.py from the real data)
  site/talk/fonts/*.woff2   Newsreader and IBM Plex (SIL Open Font License), offline
  site/talk/media/<clip>.mp4  each clip the deck plays, CUT to the slide's start/end and
                            re-encoded for the web (1080p H.264, no sound, fast start)
  site/talk/media/<clip>.jpg  its last frame: the poster, the fallback still, the PPT image
  site/talk/media/today.png   the City Pulse fallback (a screenshot from assets/)

Needs ffmpeg and the rendered clips in presentation/video/out/ (bash render.sh).
Run:  python src/presentation_data.py && python src/talk_build.py
"""
import json
import os
import shutil
import subprocess

REPO = os.path.join(os.path.dirname(__file__), "..")
TALK = os.path.join(REPO, "site", "talk")
VIDEO = os.path.join(REPO, "presentation", "video")
CRF = "30"          # quality: lower = bigger and sharper. 30 keeps a clip to a few MB.


def clips(beats):
    """{clip name: (start, end)} for every clip a beat plays or falls back to."""
    out = {}
    for b in beats:
        v = b.get("video")
        if v:
            out[v["clip"]] = (v.get("start"), v.get("end"))
        fb = (b.get("live") or {}).get("fallback", {})
        if "clip" in fb:
            out.setdefault(fb["clip"], (None, None))
    return out


def encode(name, start, end):
    src = os.path.join(VIDEO, "out", f"{name}.mp4")
    dst = os.path.join(TALK, "media", f"{name}.mp4")
    cut = (["-ss", str(start)] if start else []) + (["-to", str(end)] if end else [])
    # -ss/-to after -i: frame-accurate cuts (slower, but exact)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, *cut, "-an", "-c:v", "libx264",
                    "-preset", "slow", "-crf", CRF, "-pix_fmt", "yuv420p", "-movflags", "+faststart", dst],
                   check=True)
    # the last frame, as the poster / fallback still / PowerPoint picture
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-sseof", "-0.1", "-i", dst, "-frames:v", "1",
                    "-q:v", "3", dst.replace(".mp4", ".jpg")], check=True)
    return os.path.getsize(dst)


def main():
    with open(os.path.join(TALK, "slides.json"), encoding="utf-8") as f:
        beats = json.load(f)["beats"]
    for d in ("data", "fonts", "media"):
        os.makedirs(os.path.join(TALK, d), exist_ok=True)

    src = os.path.join(VIDEO, "public", "data")
    for name in sorted(os.listdir(src)):
        if name.endswith(".json"):
            shutil.copy(os.path.join(src, name), os.path.join(TALK, "data", name))
    for name in os.listdir(os.path.join(VIDEO, "public", "fonts")):
        if name.endswith((".woff2", ".md")):          # the fonts and their licence note
            shutil.copy(os.path.join(VIDEO, "public", "fonts", name), os.path.join(TALK, "fonts", name))
    shutil.copy(os.path.join(REPO, "assets", "screenshot-today.png"), os.path.join(TALK, "media", "today.png"))

    total = 0
    for name, (start, end) in clips(beats).items():
        size = encode(name, start, end)
        total += size
        cut = f" cut {start or 0}s to {end or 'end'}" if (start or end) else ""
        print(f"  {name:16s}{cut:22s} {size / 1e6:5.1f} MB")
    print(f"site/talk/media: {total / 1e6:.1f} MB of clips for {len(beats)} beats")


if __name__ == "__main__":
    main()
