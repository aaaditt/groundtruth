# Ask the ground: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any visitor ask the model what weekday any city-day from 2019 to 2026 was, with
honest out-of-fold guesses, inside a redesigned dark "in orbit" site with synthesised sound and
millimetre chart paper.

**Architecture:** A Python script (`src/ask.py`, with the logic in `groundtruth/ask.py`) turns
the local MUSTANG cache into one JSON file per station of out-of-fold weekday probabilities.
The static site gains Ask mode on `globe.html` (`site/ask.js`) and a shared sound engine
(`site/sound.js`), and gets one dark design system (`site/style.css`, `common.js` helpers).

**Tech Stack:** Python 3.11, pandas, scikit-learn (the existing `make_model` and `make_cv`),
vanilla JS, MapLibre GL 5.6.0, the Web Audio API, Playwright (checks only), ffmpeg (media).

**Spec:** `docs/superpowers/specs/2026-11-06-ask-the-ground-design.md`

## Global Constraints

- Real data only. Never hand-edit `site/data/`; `site/data/ask/*.json` is written only by
  `src/ask.py`.
- Train only on `period == "baseline"`; lockdown window 2020-03-01 to 2020-06-30 is
  `period = "lockdown"` for every station; GroupKFold(5) by `week_id`; `random_state=0`.
- `level` = robust z of `level_raw` vs all baseline days of the previous 56 days, at least 10
  reference days, or else the day is not scored.
- Record: 2019-01-01 to 2026-09-30 (`history.json` `start` / `end_exclusive`).
- Page scripts use `textContent` only; script names match `[a-z]+\.js`.
- Fonts: Gloock (display) and Schibsted Grotesk (text), from Google Fonts. One dark theme.
- Colours: space `#000`, ink `#eef1f6`, dim `#aab3c0`, glow `#9cc8ff`, plus the existing dark
  diverging ramp.
- Sound starts only after a user gesture, has an on/off switch in every bar remembered in
  `localStorage["gt-sound"]`, and carries no information that isn't also on screen.
- Every commit ends with the two trailers in CLAUDE.md / the session reminder, and runs
  `.venv/Scripts/python -m pytest -q` first.
- Check every page in Playwright (desktop 1440 px, phone 390 px) with zero console errors
  before declaring a stage done.

## Review Focus

- A city-day with no data (station offline): the calendar square is hollow, clicking it says
  "No recording that day" with no answer and no crash. Pinned by `test_unscored_days_have_no_probs`
  and the Playwright check of `#ask/IU.DAV..BHZ/<a missing date>`.
- A hash pointing at a bad station or date (`#ask/NOPE/2031-01-01`): Ask opens on the default
  example instead of failing. Pinned in the Task 5 Playwright check.
- Sound on a browser that blocks audio until a gesture: no console error, and the switch still
  works. Pinned in the Task 4 Playwright check (no console errors before any click).
- Phone width: the 53-column year view must not force horizontal page scroll; it scrolls
  inside its own box. Pinned in the Task 5 Playwright check (`scrollWidth <= innerWidth`).
- Sharjah across its 2022 weekend change: the answer uses the weekend rule in force on that
  date. Pinned by `test_weekend_flag_follows_the_rule_in_force`.

---

### Task 1: Out-of-fold Ask data (`groundtruth/ask.py`, `src/ask.py`)

**Files:**
- Create: `groundtruth/ask.py`, `src/ask.py`, `tests/test_ask.py`
- Writes: `site/data/ask/<station>.json` (33 files), `outputs/tables/ask_scores.csv`

**Interfaces:**
- Consumes: `groundtruth.mustang.rms_series(id, start, end)`, `features.clean_rms`,
  `features.daily_features`, `live.label_days(feats, country)`, `models.make_model`,
  `models.make_cv`, `models.week_id`, `calendars.is_weekend`, `src/history.roster()` (the
  33-station roster, with timezone and country).
- Produces:
  - `ask.mark_lockdown(d: DataFrame) -> DataFrame`, which sets `period="lockdown"` inside
    `LOCKDOWN = ("2020-03-01", "2020-06-30")`.
  - `ask.rolling_level(d) -> Series`, giving `level`, or NaN when there are fewer than 10
    reference days.
  - `ask.oof(d) -> DataFrame`, with columns `fold`, `p0`..`p6` (float) and `pred` for scored
    days.
  - `ask.scores(d) -> dict`, with keys `dow_acc`, `weekend_bal_acc`, `holiday_as_weekend`,
    `n_days`, `n_scored`.
  - JSON per station, shape:
    `{"id","city","country","timezone","start","end_exclusive","weekend":{"since":[[date,[dows]]...]},
      "usual":{"0":[24],..."6":[24]}, "days":[[i, shape24|null, probs7|null, period, holiday, fold]...]}`.
    Here `i` is the day index from `start`, shape values are rounded to 3 decimals and probs
    to whole percent.

- [ ] Step 1: write `tests/test_ask.py`. The tests read the committed `site/data/ask/*.json`
  and `ask_scores.csv` (real data only):
  - `test_one_file_per_history_station`: the ids match `history.json`.
  - `test_each_week_sits_in_one_fold`: per station, map each scored day to its ISO
    `week_id`; every week has exactly one fold.
  - `test_probs_sum_to_100`: abs(sum − 100) ≤ 4 for every scored day.
  - `test_unscored_days_have_no_probs`: a day with null shape has null probs.
  - `test_lockdown_window_never_baseline`: every day from 2020-03-01 to 2020-06-30 has
    period `"lockdown"`.
  - `test_scores_table_matches_files`: recompute exact-day accuracy from the files, which
    must match within 0.001.
  - `test_weekend_flag_follows_the_rule_in_force`: the Sharjah file's `weekend.since` lists
    Fri/Sat before 2022-01-01 and Sat/Sun after.
  - A unit test on `rolling_level` against a real 70-day slice of the Brussels cache:
    `tests/fixtures` if present, otherwise skip when the cache is missing.
- [ ] Step 2: run `pytest tests/test_ask.py`. They fail (no files yet).
- [ ] Step 3: implement `groundtruth/ask.py` and `src/ask.py` (prints a per-city table and
  writes the files; about 10 min).
- [ ] Step 4: run `python src/ask.py`, then the tests pass. Read the per-city table.
- [ ] Step 5: add Result 16 to `docs/04-results.md`, with the method, the table summary, the
  limits (later lockdowns, sensor swaps, Sharjah) and the commands. Then commit
  "Ask: out-of-fold weekday guesses for every city-day, 2019-2026 (Result 16)".

### Task 2: Design system (`style.css`, every page's head and bar, `common.js`)

**Files:** Modify `site/style.css` (rewrite the tokens and base components, dark only); every
`site/*.html` (`<head>` fonts, bar markup); `site/common.js`; `tests/test_site_pages.py`.

**Interfaces:**
- Produces:
  - `paperGrid(svgEl, {x0,x1,y0,y1,cols,rows,major:6})`, which appends the
    `<pattern>`-based mm grid. `cols` is the number of hour divisions (24 → 120 fine lines).
  - `smoothPath(points: [x,y][]) -> string`: Catmull-Rom to cubic, through every point.
  - CSS classes `.pen`, `.pen-glow`, `.ghost-weekday`, `.ghost-weekend`.
  - The bar: `<header class="bar">` with the mark, `<nav aria-label="Site">` and
    `<button class="sound" id="sound" aria-pressed>`.
- NAV becomes `globe.html#ask, globe.html, today.html, game.html, research.html, about.html`.
  `globe.html` statically marks `globe.html`; Ask mode moves `aria-current` at run time.
- [ ] Step 1: update `test_every_page_has_the_same_menu` to the new NAV, and add
  `test_every_page_loads_sound_and_new_fonts` (`sound.js` script tag and `family=Gloock` in
  every HTML page). These fail.
- [ ] Step 2: implement the CSS tokens, type scale and components; update the heads and bars;
  add the helpers to `common.js`; switch the tour, Today and game charts to `paperGrid` and
  `smoothPath`.
- [ ] Step 3: run pytest (passes) and Playwright `check_site2.py` (clean), and review the
  screenshots.
- [ ] Step 4: commit "One dark design: Gloock + Schibsted Grotesk, millimetre chart paper".

### Task 3: Sound engine (`site/sound.js`)

**Files:** Create `site/sound.js`; add it to every page.

**Interfaces:**
- Produces: `window.GTSound = { on(): bool, toggle(), whoosh(strength=1, pan=0), tick(),
  scratch(ms), chime(), ambient(bool) }`. It is safe to call before unlocking (it does
  nothing).
- It self-wires: clicks on `button, a, [role=button], .day` → `tick()`; same-origin link
  navigation → `whoosh()`; then it navigates after 140 ms.
- [ ] Step 1: implement with an AudioContext created on the first gesture; master gain 0.5;
  ambient bus at −30 dB with a generated impulse reverb; `visibilitychange` fades to 0.
- [ ] Step 2: Playwright: load every page, no console errors before or after a click; toggle
  the button, check `localStorage["gt-sound"]` flips, and check
  `GTSound.on()` reflects it.
- [ ] Step 3: commit "Sound: a synthesised ambient bed, whooshes, ticks and a chime".

### Task 4: Ask mode on the globe page (`site/ask.js`)

**Files:** Create `site/ask.js`; modify `site/globe.html` (an `#ask` section),
`site/globe.js` (expose `H`, `map`, `select`, `dateOf`, `indexOf`; calendar clicks open Ask),
`site/style.css`.

**Interfaces:**
- Consumes: Task 1 JSON, Task 2 `paperGrid` and `smoothPath`, Task 3 `GTSound`, globe.js
  globals.
- Produces: `openAsk(stationId, dateStr)` and `closeAsk()`; hash `#ask/<id>/<date>`.
- Behaviour:
  - Year view: 53 × 7 squares, coloured by `level`, with the year buttons.
  - The sentence: city select and date.
  - The Earth: `flyTo` the city, plus `whoosh`.
  - The pen line draws over 1.6 s with the weekday and weekend ghosts, plus `scratch`.
  - The answer: `chime`, the guess and its confidence, the truth and the holiday, with the
    model's 7 bars.
  - Suggestions are built from the data: that city's Christmas, a lockdown Monday, its
    holidays, and a random scored day.
- [ ] Step 1: implement; Escape and "Back to the globe" close it.
- [ ] Step 2: Playwright at desktop and phone:
  - `globe.html#ask/BE.UCC..HHZ/2019-12-25` shows "Sunday" as the guess;
  - a bad hash falls back;
  - a missing day shows "No recording";
  - `scrollWidth <= innerWidth`;
  - no console errors.
- [ ] Step 3: commit "Ask the ground: pick any city-day, watch the model read it".

### Task 5: The rest of the site in the new look

**Files:** `site/index.html` and `tour.js` (stop 5 and the hero lead into Ask), `today.*`,
`game.*`, `research.*`, `about.html`, `watch.html`.

- [ ] Step 1: restyle each page and point the tour's ending and the hero button to Ask.
- [ ] Step 2: Playwright on all pages at both widths, then pytest.
- [ ] Step 3: commit "Every page in the orbit look; the tour ends in Ask".

### Task 6: Naive-visitor review and fixes

- [ ] Step 1: a subagent plays a first-time visitor: a science undergraduate, IQ 90-100, who
  knows nothing about the project. Using Playwright screenshots, they walk the site and report
  what confused them, what they missed and what impressed them.
- [ ] Step 2: fix every reasonable point, then re-run the checks and commit.

### Task 7: Docs, media, ship

- [ ] Step 1: update README (headline Result 16, features, Ask link), CHANGELOG 1.4.0 and
  `pyproject` version, the work log, CLAUDE.md (Ask data, sound, one theme), docs/02 (fonts),
  and the presentation guide.
- [ ] Step 2: re-capture the screenshots and GIF (`scripts/`), and update
  `video/record_scenes.py` and the captions for the new design, adding an Ask scene. Then
  re-record and re-assemble the video.
- [ ] Step 3: run pytest and the full Playwright pass, then commit, push, and verify the live
  Vercel site.
