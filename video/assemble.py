"""Assemble the demo video: scene clips + crossfades + subtitles + chapters + poster.

Reads video/build/scenes/*.mp4 (record_scenes.py) and video/captions.json. Writes:
  site/media/groundtruth-demo.mp4   1080p30 H.264 + AAC: the site's own drone chord and a soft
                                    whoosh at each scene change (made here by ffmpeg, no files),
                                    with a narration track mixed on top when video/build/voice.m4a exists
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
POSTER_AT = ("ask", 15.5)       # scene and second for the poster frame: Christmas 2019 read as a Sunday
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
    silent = OUT.with_name("_video.mp4")
    cmd += ["-filter_complex", ";".join(f), "-map", "[vout]", "-an",
            "-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf), "-profile:v", "high", "-r", "30",
            str(silent)]
    subprocess.run(cmd, check=True)

    # sound: the drone chord sound.js plays on the site (D2 A2 D3 E3 A3, each breathing slowly),
    # through a low-pass and an echo, plus a soft air whoosh at every crossfade
    voices = [(73.42, .16, .030), (110, .11, .047), (146.83, .08, .064), (164.81, .05, .081), (220, .035, .098)]
    drone = "+".join(f"{a}*sin(2*PI*{fq}*t)*(0.6+0.4*sin(2*PI*{lf}*t+{k}))" for k, (fq, a, lf) in enumerate(voices))
    drone_r = "+".join(f"{a}*sin(2*PI*{fq * 1.0012:.3f}*t)*(0.6+0.4*sin(2*PI*{lf}*t+{k + 0.7}))" for k, (fq, a, lf) in enumerate(voices))
    a = [f"aevalsrc='{drone}|{drone_r}':s=48000:d={total:.3f},lowpass=f=650,aecho=0.8:0.6:180|320:0.3|0.2,"
         f"volume=0.55,afade=t=in:d=3,afade=t=out:st={total - 3:.3f}:d=3[bed]"]
    mix = ["[bed]"]
    for k, st in enumerate(starts[1:]):
        ms = int(max(st - 0.45, 0) * 1000)
        a.append(f"anoisesrc=color=pink:d=1.3:a=0.5:s=48000,bandpass=f=850:width_type=o:w=1.6,"
                 f"afade=t=in:d=0.5,afade=t=out:st=0.5:d=0.8,volume=0.5,aformat=channel_layouts=stereo,adelay={ms}|{ms}[w{k}]")
        mix.append(f"[w{k}]")
    voice = HERE / "build" / "voice.m4a"
    inputs = ["-i", str(silent)]
    if voice.exists():
        inputs += ["-i", str(voice)]
        a.append("[1:a]volume=1.0,aformat=channel_layouts=stereo[vo]")
        mix.append("[vo]")
        a.append(f"{''.join(mix[:-1])}amix=inputs={len(mix) - 1}:normalize=0,volume=0.45[music]")
        a.append("[music][vo]amix=inputs=2:normalize=0[aout]")
    else:
        a.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0,volume=2.2[aout]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(a),
                    "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
                    "-movflags", "+faststart", "-metadata", "title=GroundTruth: the ground knows what day it is",
                    str(OUT)], check=True)
    silent.unlink()

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
