# Changelog

What changed in each version of GroundTruth. Versions follow semantic versioning;
`1.0.0` is the git tag `v1.0-semester`. The daily `pulse: data` commits only add a new
day of data and are not listed.

## [1.7.1] - 2026-11-25

### Changed

- **The presenter sets the pace, not the clips.** Every clip in the talk deck stops at
  each of its beats (29 stops in 9 clips, `presentation/video/src/cues.json`) and waits for
  Space, the clicker, Next or one tap. Where the city is on screen the stop is a living
  hold: the camera and captions stay still while cars, people, trains and waves keep
  moving (15 seamless 8-second loops, rendered with a stopped story clock and a running
  background clock: `useSec` / `useAmbient` in `presentation/video/src/lib.tsx`). Pressing
  Next mid-clip jumps to the stop; Back returns to the previous stop, or to the previous
  slide's last stop. The clips deck PowerPoint cuts each clip at its stops (one slide per
  segment). The clips themselves are unchanged frame for frame.
- **Three block diagrams** in the talk (docs/21 beats 9, 15, 21), each building one group
  of boxes per press: *From the ground to a guess* (data → 25 numbers → forest → graded on
  hidden weeks → what it is for), *From a mistake to an alarm* (real Christmas Day in
  Brussels: guess → surprise → above 95% of ordinary days → flag) and *What runs every
  night* (EarthScope → GitHub Action → frozen and learning models → site/data → Vercel).
  The speech around them now walks through the boxes; the talk is 25 beats, about 15
  minutes. In the PowerPoint each diagram is one slide per step.
- **Research scope and data provenance** (docs/21 beats 5, 6, 8). *Who listened to cities
  before us*: seven papers from 2009 to 2025 (Groos & Ritter; Díaz; Lecocq; Cannata;
  Nimiya; Yang; Liu), each checked against its publisher's page and cited with its DOI in
  docs/02. *Where they stopped, and where we start*: averages vs single unseen days, one
  city vs 149 and 33 × 7 years, phone data vs none, removing people vs keeping them as the
  signal, new fibre vs seismometers already in place. *Where every recording comes from*:
  the four datasets and the 59 seismic networks behind them (54 with a DOI), from the FDSN
  network registry (`src/sources_export.py` → `site/data/sources.json`).
- **Every station on the website shows where its data comes from**: the research map's
  popups and the globe's station panel name the seismic network, link its DOI, and say
  which dataset it came through (`sourceLine` in `site/common.js`).
- The method diagram now follows `docs/03-methodology.md`'s six steps, labelled Step 1–6
  (it adds Step 3, the calendar labels, which the first version left out). The talk is
  28 beats, about 16 minutes.
- **How the model decides** (docs/21 beats 16–18): *How one guess is made* (the real
  Wednesday in Brussels: 25 numbers in, 100 trees vote 31 Fri / 25 Tue / 23 Mon / 5 Wed /
  3 weekend, so "Friday" is wrong but "weekday" is right), *What the model looks at*
  (impurity importance: midnight, 13:00 and 06:00 lead; the level ranks 10 of 25) and *Where
  it gets it wrong* (the 7×7 confusion matrix, Brussels out of fold and all 149 seismometers
  pooled, 16,554 days: weekdays blur, the weekend stands apart). Exported by
  `src/presentation_data.py` → `ml.json`; the pooled matrix is in docs/04 under Result 1.
- **Every website feature in the talk** (beats 27–32): an *Everything we built* diagram,
  then live: the front-page tour, Ask and the globe, City Pulse in three steps (the nightly
  board, the learning card, the predictions board) and the Guess-the-day game, each with a
  screenshot fallback. The talk is 34 beats, 19:53.

## [1.7.0] - 2026-11-24

### Added

- **The story talk** (`docs/21`): 22 beats mixing stills, short clips and the live site,
  revised after three read-only reviews. Presented from a **web deck**, `site/talk/`
  (clicker, arrows, Next/Back, three-finger swipe; live globe, Ask and City Pulse inside it
  with automatic fallbacks; a progress strip drawn from the real Brussels recording), and
  built as two PowerPoints from the same `slides.json` (`presentation/story/build_pptx.cjs`).
  `src/talk_build.py`, `tests/test_talk.py`.
- **Result 20** (exploratory): the 7-year models score 100.0% on days they trained on and
  55.2% on weeks they never saw. `src/memorisation.py`.
- **Result 21** (pre-registered, `docs/19`): nightly walk-forward learning, predict then
  learn, on the 7 live cities. City Pulse shows frozen vs learning as interim; graded in
  January 2027. `groundtruth/pulse.py` `score_walk_forward`, `tests/test_walk_forward.py`.
- **Result 22** (pre-registered, `docs/20`): second-by-second waveforms, 775 pairs at 21
  stations: subtracting the learned normal finds fewer earthquakes than the raw recording
  (413 vs 501, not supported); a rolling 5-minute baseline finds most (524).
  `src/quake_waveform.py`, `groundtruth/quakewave.py`.
- `src/plot_learning_curve.py`: Result 18 as one picture.

### Changed

- Site pages opened with `?embed=1` are silent and hide the site bar (for the deck).

## [1.6.0] - 2026-11-07

### Added

- **Result 18**, pre-registered (`docs/16-more-data-preregistration.md`): more days per
  station, one model for all cities, and more boosting rounds. None lifts the one-day
  exact-weekday score past ~57%; pooling cities hurts. `src/more_data_experiment.py`.

### Changed

- **Ask the ground** answers in two steps: weekday or weekend from the day alone (Result 17
  single-day model, 97.1% median), then which day from the week around it (96.1%), with a
  strip of the 7 days. `src/ask.py`, `groundtruth/ask.py` (`oof_week`), `site/ask.js`.

## [1.5.0] - 2026-11-07

### Added

- **Result 17**, pre-registered (`docs/15-weekday-preregistration.md`): can the ground name
  the exact weekday? From one day, three frequency bands and half-hour detail raise the
  median from 47.5% to 56.7% (33 of 33 stations better). Given the 7 days around a day, the
  median is 96.1% (25 of 33 stations at 90% or more). `src/weekday_experiment.py`,
  `groundtruth/weekday.py`, `tests/test_weekday.py`.

## [1.4.0] - 2026-11-06

### Added

- **Ask the ground** (`globe.html#ask`, `site/ask.js`): pick any of 33 cities and any day
  from 2019 to 2026; watch that day's line draw and see which weekday the model thinks it
  was, next to the truth. Every guess is out of fold (Result 16, `src/ask.py`,
  `site/data/ask/`). The city's year, one column per week, is the date picker.
- **Sound** (`site/sound.js`): an ambient drone, whooshes, ticks, a pen scratch and a
  chime, all synthesised in the browser; off with one switch, never before a click.
- Result 16 in `docs/04-results.md`; tests for the Ask data (`tests/test_ask.py`).

### Changed

- **One dark "Orbit" look** on every page: Gloock and Schibsted Grotesk, glowing pen
  lines, millimetre chart paper. The light theme is retired.
- "Ask" is first in the menu; the tour's hero, quiz and last stop lead into it.

## [1.3.0] - 2026-11-05

### Added

- **The front page is a scrolling tour** (`site/index.html`, `tour.js`): the Earth in the
  real night sky, one day under Brussels drawn by a pen as you scroll, March 2020 going
  quiet city by city, and a weekday-or-weekend quiz against the model. Every number in it
  is computed in the browser from the existing `site/data/` files. Returning visitors get
  "Open the globe" first; a skip link is always visible.
- **Today page** (`site/today.html`): one row per live city in place of the old dashboard
  cards, with the predictions board at the bottom.
- **Demo video** (`site/watch.html`): a two-minute captioned walkthrough recorded from the
  live site, with chapters and a subtitle track. Rebuilt by `video/record_scenes.py` and
  `video/assemble.py`.
- **README demo GIF and screenshots** (`assets/`), re-captured by `scripts/record_demo.py`
  and `scripts/screenshots.py`.
- `LICENSE` (MIT, for the code; the data keeps its sources' licences, see the README) and
  this changelog.
- Tests: the same menu on every page, the tour's stops and skip link, no `innerHTML` in
  any page script, and script names the cache-busting step can stamp.

### Changed

- **Hosting moved to Vercel**: https://groundtruth-seismic.vercel.app/. Plain static
  files from `site/` (`vercel.json`, no build step), always revalidated. Every push to
  `main` redeploys, and the daily job also calls a deploy hook. GitHub Pages is still
  published as a mirror.
- **One "Drum" look on every page**, after seismograph drum recorders: chart-paper light
  theme, smoked-drum dark theme, Old Standard TT and Libre Franklin.

### Removed

- `site/app.js` (the old dashboard script; its job is now `today.js`).

## [1.2.0] - 2026-11-04

### Added

- **Satellite globe**: NASA Blue Marble imagery (via GIBS) floating in space, with every
  naked-eye star from the Yale Bright Star Catalogue at its real position.

### Changed

- **Honest station labels**: a station is named after where its sensor is when that is
  more than 20 km from the city in the 2020 paper's Table S1, for example "Valinhos (near
  Campinas)". Distances from GeoNames (`src/check_places.py`).

## [1.1.0] - 2026-11-04

### Added

- **2019–2026 history** from EarthScope MUSTANG, with the 2020 lockdown reproduced at 6
  of 6 cities within 0.7 points, a check written down before the download (Result 14).
- **Time-travel globe** (`site/globe.html`): 33 cities, every day since January 2019,
  each coloured against the same weekday over the previous 8 weeks; a city's whole year
  as a calendar (Result 15).

### Fixed

- Coordinates for Nilore (Table S1 puts it in Paraguay) and Davao (in Malaysia), from the
  FDSN station service.
- The MUSTANG parser is 8× faster, and bit-identical to the old one (tested).

## [1.0.0] - 2026-11-04

Tagged `v1.0-semester`: everything promised for the course.

### Added

- **The five promises** (Results 5–9): class weighting, shape against loudness, the
  model's confusion as a holiday detector, held-out holidays, cross-region transfer.
- **Pre-registered UAE weekend experiment** (`docs/14`): result supported (Sunday 20%
  quieter after the 2022 weekend change, p = 0.003).
- **Live models** for 7 cities, trained on Oct 2025 – Sep 2026 (Result 11).
- **City Pulse dashboard**, updated every day by GitHub Actions, and **18 predictions**
  committed before their day and graded automatically.
- Band test (Result 12), the 158-city research map, the guess-the-day game, and the
  final report (`docs/13`).

## [0.2.0] - 2026-11-03

### Added

- Weekends per country and real public holidays as labels (Stage 1).
- The `groundtruth` package, the station roster, tests on real data and CI that rebuilds
  the dataset and checks it matches (Stage 2).
- Recent data from EarthScope MUSTANG, validated against the published data (Stage 3).

## [0.1.0] - 2026-09-20

### Added

- Day-of-week and disruption detection from urban seismic noise, on the Lecocq et al.
  (2020) dataset, vendored verbatim into the repository.
- Cross-country weekend analysis, the proposal figures and the proposal script.
