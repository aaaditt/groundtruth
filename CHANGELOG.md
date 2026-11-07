# Changelog

What changed in each version of GroundTruth. Versions follow semantic versioning;
`1.0.0` is the git tag `v1.0-semester`. The daily `pulse: data` commits only add a new
day of data and are not listed.

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
