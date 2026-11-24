"""
clips.py -- cut the "Running live" clip (S11) from the website's own demo video.

The demo video (site/media/groundtruth-demo.mp4, built by video/assemble.py from screen
recordings of the live site) already shows the globe and the Today page. Rather than
re-recording, we cut those two chapters out, using the chapter times the demo itself
publishes (site/media/chapters.json). Audio is dropped: the speaker talks over it.

Run:  python presentation/clips.py      (needs ffmpeg on PATH; a few seconds)
Writes presentation/video/out/S11-live.mp4
"""
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DEMO = os.path.join(REPO, "site", "media", "groundtruth-demo.mp4")
OUT = os.path.join(HERE, "video", "out", "S11-live.mp4")


def main():
    with open(os.path.join(REPO, "site", "media", "chapters.json"), encoding="utf-8") as f:
        chapters = json.load(f)
    start = {c["id"]: c["start"] for c in chapters}
    order = [c["id"] for c in chapters]
    # from the start of "globe" to the start of the chapter after "today"
    t0 = start["globe"]
    t1 = start[order[order.index("today") + 1]]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t0:.2f}", "-to", f"{t1:.2f}",
                    "-i", DEMO, "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", OUT],
                   check=True)
    print(f"S11-live: {t0:.1f}s to {t1:.1f}s of the demo ({t1 - t0:.1f} s) -> {OUT}")


if __name__ == "__main__":
    main()
