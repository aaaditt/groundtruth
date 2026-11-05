"""Assemble the demo video: scene clips + crossfades + subtitles + chapters + poster.

Reads video/build/scenes/*.mp4 (record_scenes.py) and video/captions.json. Writes:
  site/media/groundtruth-demo.mp4   1080p30 H.264, no audio track (the captions carry the story)
  site/media/groundtruth-demo.vtt   the same captions as subtitles, for screen readers and the watch page
  site/media/groundtruth-demo.srt   the same, for video players
  site/media/chapters.json          scene start times, for the watch page
  site/media/still.jpg              the watch page's poster frame
  site/media/poster.jpg             the same frame with a play badge, for the README thumbnail
The media is served by the live site (watch.html), so browsers stream it.

Usage: python video/assemble.py [--crf 24]
"""

import argparse
import json
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SCENES = HERE / "build" / "scenes"
MEDIA = ROOT / "site" / "media"
OUT = MEDIA / "groundtruth-demo.mp4"
XF = 0.7                    # crossfade between scenes, seconds
POSTER_AT = ("quiet", 13.0)     # scene and second for the poster frame: the drum record in April 2020
PLAY_FONT = r"C\:/Windows/Fonts/seguisym.ttf"   # has the play glyph; colon escaped for ffmpeg


def stamp(t, sep):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}{sep}{ms % 1000:03d}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--crf", type=int, default=24)
    args = parser.parse_args()
    spec = json.loads((HERE / "captions.json").read_text(encoding="utf-8"))["scenes"]

    starts, t = [], 0.0
    for s in spec:
        starts.append(t)
        t += s["length"] - XF
    total = starts[-1] + spec[-1]["length"]

    # video: one crossfade chain through every scene
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    for s in spec:
        cmd += ["-i", str(SCENES / f"{s['id']}.mp4")]
    f, prev = [], "0:v"
    for i in range(1, len(spec)):
        f.append(f"[{prev}][{i}:v]xfade=transition=fade:duration={XF}:offset={starts[i]:.3f}[v{i}]")
        prev = f"v{i}"
    f.append(f"[{prev}]fade=t=in:st=0:d=0.8,fade=t=out:st={total - 1.4:.3f}:d=1.4,format=yuv420p[vout]")
    MEDIA.mkdir(parents=True, exist_ok=True)
    cmd += ["-filter_complex", ";".join(f), "-map", "[vout]", "-an",
            "-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf), "-profile:v", "high", "-r", "30",
            "-movflags", "+faststart", "-metadata", "title=GroundTruth: the ground knows what day it is", str(OUT)]
    subprocess.run(cmd, check=True)

    # subtitles: each caption runs until the next one in its scene, or the scene's end
    cues = []
    for i, s in enumerate(spec):
        caps = s["captions"]
        for j, (at, main, *small) in enumerate(caps):
            a = starts[i] + at
            b = starts[i] + (caps[j + 1][0] - 0.2 if j + 1 < len(caps) else s["length"] - XF - 0.3)
            cues.append((a, b, main))
    srt = [f"{k}\n{stamp(a, ',')} --> {stamp(b, ',')}\n{text}\n" for k, (a, b, text) in enumerate(cues, 1)]
    OUT.with_suffix(".srt").write_text("\n".join(srt), encoding="utf-8")
    vtt = [re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", c) for c in srt]
    OUT.with_suffix(".vtt").write_text("WEBVTT\n\n" + "\n".join(vtt), encoding="utf-8")

    (MEDIA / "chapters.json").write_text(json.dumps(
        [{"id": s["id"], "title": s["chapter"], "start": round(starts[i], 2)} for i, s in enumerate(spec)],
        indent=1), encoding="utf-8")

    # poster: one frame, plain for the watch page (the browser draws its own play button)
    # and with a play badge for the README thumbnail
    sid, sec = POSTER_AT
    at = starts[[s["id"] for s in spec].index(sid)] + sec
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{at:.2f}", "-i", str(OUT), "-frames:v", "1",
                    "-vf", "scale=1280:-1", "-q:v", "3", str(MEDIA / "still.jpg")], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{at:.2f}", "-i", str(OUT), "-frames:v", "1",
                    "-vf", "scale=1280:-1,drawbox=x=(iw-140)/2:y=(ih-140)/2:w=140:h=140:color=0x15181c@0.85:t=fill,"
                           f"drawtext=fontfile='{PLAY_FONT}':text='▶':fontcolor=0xf1f3ef:fontsize=78:x=(w-text_w)/2+5:y=(h-text_h)/2",
                    "-q:v", "3", str(MEDIA / "poster.jpg")], check=True)

    print(f"{OUT.relative_to(ROOT)}  {total:.1f}s  {OUT.stat().st_size / 1e6:.1f} MB  {len(cues)} captions")


if __name__ == "__main__":
    main()
