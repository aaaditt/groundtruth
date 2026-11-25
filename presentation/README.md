# presentation/: the final talk

## The story version (docs/21): present from the web deck

The current talk is [`docs/21-story-presentation-script.md`](../docs/21-story-presentation-script.md):
22 beats that mix **still slides**, **short clips** (cut from the clips below) and the
**live website**. It has two forms, built from one file, `site/talk/slides.json`:

| Form | Where | Use it for |
|---|---|---|
| **Live deck** | `site/talk/` → https://groundtruth-seismic.vercel.app/talk/ | Presenting on the smartboard. Clicker, arrow keys, Space, Next/Back buttons, one tap on a clip or still, or a three-finger swipe; one finger uses the live globe and maps. Clips stop at every beat and wait for you, with the city still moving (below). `F` full screen, `N` notes, `P` presenter window, `L` show a live slide's fallback, `B` black screen. |
| **PPT + video** | `presentation/GroundTruth-story.pptx` (rebuilt, not committed) | Presenting offline: stills as pictures, clips embedded, live beats as their fallback clip plus the live link. |
| **Submission** | `presentation/GroundTruth-story-submission.pptx` (rebuilt) | Handing in: pictures only (~3 MB), speaker lines in the notes. |

Rebuild (after any result changes):

```bash
python src/presentation_data.py        # numbers, from the real data (story.json = 7-year beats)
python src/talk_build.py               # copy data + fonts into site/talk/, cut and compress the clips
node presentation/story/build_pptx.cjs # photograph each slide (headless Chrome), write both .pptx
pytest -q tests/test_talk.py           # slides file complete, assets exist, no typed numbers
```

**Block diagrams that build.** A still can have `"steps": n` in slides.json: its chart
draws `<g data-step="k">` groups (`stepGroup` in talk.js) and each press shows the next
one. The three diagrams (pipeline, alarm, nightly) use it; their numbers come from
`data/*.json` like every other chart.

**Stops: you set the pace, not the clip.** Each clip stops at its beats
(`presentation/video/src/cues.json`) and waits for the next press. Where the city is on
screen, the stop is a living hold: a separate 8-second loop rendered with the story clock
(camera, captions, charts) stopped at the stop and the background clock (cars, trains,
people, ripples, waves) still running (`useSec` vs `useAmbient` in `src/lib.tsx`;
compositions `<clip>-hold-<tenths>`). The loop's first frame is the clip's frame at the
stop, and `src/talk_build.py` blends its last second into one second rendered before the
stop, so it repeats without a jump. Press Next during a clip: it jumps to the stop. To move
a stop, edit `cues.json`, then `bash render.sh --holds && python src/talk_build.py`. In
`GroundTruth-story.pptx` each clip is cut at its stops into one slide per segment.

On the day: open the deck 10 minutes early on the classroom machine so the globe has
loaded; turn off Windows' own three/four-finger touch gestures (Settings → Bluetooth &
devices → Touch) so the swipe reaches the browser. If a live page hasn't loaded in 5
seconds, its fallback appears by itself.

---

## The all-video version (docs/18)

Everything for the 15-minute final presentation: the clips, the slides, and how to
rebuild them. The words are in [`docs/18-final-presentation-script.md`](../docs/18-final-presentation-script.md).

Speakers: **Aadit**, **Shraddha** and **Aradhya**, trading every 30 to 90 seconds (the
speakers of each slide are in the table below and in the slide notes).

**The look** matches the proposal deck: light paper, Newsreader for headings, IBM Plex
Sans for text, IBM Plex Mono for sources, burnt orange for people, blue for the sea.
**Every clip is a 3D scene**, rendered like the first one (C1):
- **The city clips:** the questions, Christmas, the promises, lockdown, the scorecard and the close happen in the same city as C1. It is a whole city, with one section dug out in front of the seismometer.
- **The globe clips:** the stations and the weekends happen on the C3 globe.
- **The data clips:** the features, weeks, results, mistakes and limits are sculptures on a paper table, where every marble, tile and column is a real value.
- **Text:** captions are sharp HTML on top of the 3D. Labels follow the camera (`Pin`). The signs have real typeset text drawn into the scene.

## What's here

| Path | What it is |
|---|---|
| `video/` | The clips, made with [Remotion](https://www.remotion.dev/) (animation written in React, rendered to MP4) |
| `video/public/data/*.json` | Every number and curve the clips draw, written by `src/presentation_data.py` from the real data |
| `video/src/scenes/` | The clips: `C1City`…`C5Quake` (cutscenes), `Open3D` (S00–S02, S13, S14 in the city), `Data3D` (S05–S08, S12 on the paper table), `World3D` (S09 lockdown city, S10 globe) |
| `video/src/three/` | The 3D pieces: the city block and seismometer (`City.tsx`, `Seismometer.tsx`), the surrounding city (`Metro.tsx`), lights and the camera path (`kit.tsx`), the shared worlds, labels, signs and columns (`World.tsx`) |
| `video/public/fonts/` | Newsreader and IBM Plex (Open Font License), so rendering works offline |
| `clips.py` | Cuts S11 ("running live", a backup for Q&A) out of the website's own demo video |
| `video/deck.cjs` | Builds the two PowerPoint files from the clips and the script |

**Real data only.** The 3D city, road, ground layers, sea, waves, seismometer, signs and
the shapes of the trees in the grove are drawings and say *Illustration* on screen (or in the
source line). Everything else (every line, dot, bar, pin, vote and number) comes from the
JSON above. `tests/test_presentation_data.py` checks those numbers against the README and
`docs/04`. The drawings are driven by real data too:

- in C1, the traffic follows Brussels' real hourly rhythm, and the seismometer's weight shakes with the real readings;
- in C3, the globe's pins are the real station positions;
- in C2, the landscape is BE.UCC's real spectrum, hour by hour. It is shown as ground velocity, a unit conversion of the exported acceleration;
- in C4, the first tree is the real first tree of the Brussels forest, and the votes are real;
- in S01, the Christmas street follows that day's real hourly rhythm;
- in S09, the lockdown street follows each real day's level.

## Rebuild everything (about 40 minutes)

```bash
# 1. numbers and curves from the real data (~1 min; needs data/cache/mustang/)
python src/presentation_data.py

# 2. the clips (~30 min; the 3D ones use the graphics card through --gl=angle)
cd presentation/video
npm install
bash render.sh                     # or: bash render.sh C1-city   (one clip)
python ../clips.py                 # S11, cut from site/media/groundtruth-demo.mp4

# 3. one poster frame per clip (its last frame), then the slides
bash posters.sh
node deck.cjs
```

To preview and tweak a clip live: `npx remotion studio` in `presentation/video/`.
3D rule: every movement is a function of the frame number (`useCurrentFrame`), never
three.js's own clock, or the rendered video flickers.

## The two PowerPoint files (in `presentation/`, not committed: they are rebuilt)

- **`GroundTruth-final.pptx`**: present from this. One clip per slide, full screen. Click
  once to start the clip; when a clip ends it **holds on its last frame**, so you're never
  rushed. The notes say who speaks and have their lines (Presenter View shows them).
- **`GroundTruth-final-canva.pptx`**: import this into Canva. It's the same slides with
  each clip's last frame as a picture, so the file is small enough to import. In Canva,
  drag the matching MP4 from `video/out/` onto each slide.

## Clip list

| Slide | Clip | Length | Speakers |
|---|---|---|---|
| 0 Questions | S00-questions | 45 s | Aadit, Shraddha, Aradhya |
| 1 Weekday or weekend? | S01-christmas | 20 s | Aadit |
| 2 Last time, we promised | S02-promises | 30 s | Shraddha, Aradhya |
| 3 A day under the city | C1-city (3D) | 75 s | Aadit, Shraddha |
| 4 158 seismometers | C3-globe (3D) | 40 s | Aradhya, Shraddha |
| 5 Two kinds of shaking | C2-sea (3D) | 60 s | Aadit, Aradhya |
| 6 One day becomes 25 numbers | S05-features | 60 s | Shraddha, Aadit |
| 7 A hundred trees vote | C4-forest (3D) | 40 s | Aradhya, Shraddha |
| 8 Tested on weeks it never saw | S06-weeks | 36 s | Shraddha, Aradhya |
| 9 It reads the day | S07-results | 45 s | Aadit, Shraddha |
| 10 Its mistakes find holidays | S08-mistakes | 60 s | Aradhya, Aadit |
| 11 Lockdown | S09-lockdown | 35 s | Shraddha |
| 12 The weekend moves | S10-weekends | 48 s | Aradhya, Aadit |
| 13 The dare: subtract the people | C5-quake (3D) | 45 s | Aradhya, Shraddha |
| 14 What else didn't work | S12-limits | 22 s | Shraddha |
| 15 The scorecard | S13-scorecard | 22 s | all three |
| 16 Still useless? | S14-close | 32 s | Aadit |
| backup | S11-live | 29 s | for Q&A |
