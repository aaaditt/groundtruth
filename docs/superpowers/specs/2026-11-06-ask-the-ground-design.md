# Ask the ground: design

Date: 2026-11-06. Status: agreed with Aadit in conversation; this document is the builder's brief.

## Intent

GroundTruth's strongest result is that a model can read the day of the week off one day of
ground vibration. The site does not let a visitor try that for themselves: on a first run
through, Aadit could not find it. The tour's quiz uses 223 hand-picked days and is buried at
stop 4.

The new centre of the site is **Ask the ground**. A visitor picks any city and any day from
2019 to 2026, watches that day's vibration draw as a line, and sees the model's guess beside
the truth: "It reads like a Sunday. It was a Wednesday: Christmas Day." The aim is the moment
where they say "wow, it actually found that".

Alongside it, Aadit asked for:
- a redesign that is less blocky and less confusing, in one cinematic dark look;
- sound across the site: a calm ambient bed, whooshes for Earth moves and page changes, and
  sounds for buttons;
- better "millimetre lines" on the charts.

## Goals

1. Anyone can ask about any city-day in the 2019-2026 record within one or two clicks of
   arriving, from any page.
2. Every guess shown is honest: made by a model that never trained on that day's week.
3. One visual system across every page, built on mockup B ("in orbit"): real black space,
   the real Earth, a glowing pen line. Mockup C supplies the date picker: the city's year as
   a week-by-weekday calendar.
4. Sound that feels like part of the instrument, never a nuisance.
5. Chart paper with a true millimetre hierarchy on every chart.

## Non-goals

- No new science claims. The Ask feature presents a new, reproducible evaluation (2019-2026,
  33 cities) and reports it as a new result, but nothing about the published results changes.
- No narration in this project. The ElevenLabs voice-over is waiting on an API key and is
  separate.
- No build step or framework. The site stays plain static files on Vercel.

## Anti-goals (a failure even if it works)

- Any guess made by a model that saw that day's week. Any synthetic or smoothed-in data.
- Sound that autoplays loudly, can't be turned off, or carries information that isn't also on
  screen.
- A redesign that looks like generic AI output: rounded card grids, ALL-CAPS eyebrows,
  monospace data labels, cream and terracotta (see `memory/feedback-premium-design`).
- Breaking the hard rules in CLAUDE.md: real data only, never hand-edit `site/data/`,
  `textContent` only, cite sources, update the docs with numbers.

## Decided

### The experience: one continuous flow on the globe page

`globe.html` becomes the home of Ask. The menu item **Ask** (first in the menu on every page)
opens it in Ask mode with a city already chosen. The flow:

1. **Globe.** As today: the time-travel globe, click a city.
2. **City.** The city's record opens beside the globe (the existing calendar panel).
3. **Pick a day.** Clicking any day in that calendar expands it into the full-width year view
   (mockup C): one column per week, Monday at the top, each square coloured by how quiet or
   loud that day was against the weeks around it. Weekends show up as bands without any
   explanation. Year buttons run 2019 to 2026.
   Colour (builder's call): the globe and its small calendar keep their meaning, "vs the same
   weekday over the previous 8 weeks". The expanded Ask year view colours by the Ask `level`,
   "vs all days of the previous 8 weeks", which is why the weekends appear. The expansion
   animates from one colouring to the other, and each view's legend says plainly what it
   compares against.
4. **Ask.** The question appears as a sentence: "What day was it under Brussels on 25 December
   2019?" The Earth turns and zooms towards the city (whoosh). The day's 24-hour line draws
   across the screen in the glowing pen style (pen-scratch sound), with a usual weekday and a
   usual weekend day as faint dashed and dotted lines behind it. Then the answer lights up
   (soft chime): the model's weekday guess and its confidence, then the truth, with the
   holiday name if there is one. The model is never told the date, and the page says so.
5. **Again.** Click another square, or use "a day at random" and a few suggestions taken from
   the data (a Christmas, a lockdown Monday, a national holiday). Or step back out to the
   globe.

The URL holds the state (`globe.html#ask/BE.UCC..HHZ/2019-12-25`), so any answer can be
shared and opened directly.

The front-page tour stays, but it ends by dropping the visitor into Ask. The tour's quiz
(stop 4) uses the new Ask data, so both show the same honest numbers.

### The data: out-of-fold guesses for every city-day, 2019-2026

A new script, `src/ask.py`, built from the local MUSTANG cache (`data/cache/mustang/`, 33
stations, 2019-01-01 to 2026-09-30):

- For each station: daily features with `groundtruth.features.daily_features` (24-hour shape,
  local time) and labels with `groundtruth.live.label_days` (holiday, festive, baseline;
  country weekends from `config/weekends.csv`; `week_id` with the year).
- Model: `make_model()` (the project's random forest), 7-class day of week, trained on
  **baseline days only**.
- Honesty: `GroupKFold` by `week_id`. Every day, including holiday and festive days that never
  enter training, is predicted by the fold model whose training set excludes that day's week.
  The fold of each day is saved, and a test checks it.
- One model set per station across all seven years (builder's call): about 1,800 baseline
  days instead of the published ~115, with `make_cv()` (GroupKFold(5)) on `week_id`. Sensor
  swaps and Sharjah's weekend change stay in the data, because they are part of the real
  difficulty. Result 16 says so.
- **Lockdown is not baseline** (builder's call, CLAUDE.md rule 2). Every station gets a fixed
  window, 1 March to 30 June 2020, labelled `period = "lockdown"`: never trained on, always
  predicted. Later regional lockdowns (Melbourne 2020-21 and others) stay in training. That is
  a stated limitation in Result 16, not hidden. A single fixed window needs no new
  per-country source.
- `level` is the day's `level_raw` robust z-scored (median/MAD) against **all** baseline days
  of that station in the previous 8 weeks (8 weeks is the length of the globe's window; this
  does not compare against the same weekday, which would erase the weekly signal). It needs at
  least 10 reference days, or else `level` is missing and the day is not scored. That keeps
  sensor drift across seven years (Sharjah's 1.5x jumps) out of the feature. It uses past
  levels and the holiday calendar only, never weekday labels.
- **Frozen build, like `history.json`.** `src/ask.py` runs locally from the cache (CI can't:
  `data/cache/` is not committed). Its output is committed the way `history.json` is:
  generated by a script, never hand-edited. The record ends on 30 September 2026, and the page
  says so and links to Today for newer days.
- Output: one file per station, `site/data/ask/<station>.json`, holding for each day the
  date, the 24 shape values (3 decimals), the 7 class probabilities (whole percent), the
  true weekday, the holiday name, the period and the fold. It also holds the station's
  average baseline shape per weekday, for the faint comparison lines. The globe already loads
  `history.json`, so the Ask files load one city at a time, on demand.
- Summary table `outputs/tables/ask_scores.csv`: per city, exact-day accuracy, weekday vs
  weekend balanced accuracy (country weekends), the share of weekday public holidays read as
  a weekend, and the number of days. This becomes **Result 16** in `docs/04-results.md`, with
  the headline in the README.
- Weekend changes (the UAE in 2022): the 7-class model doesn't care what a country calls the
  weekend, so the guess stays honest. The answer text uses the weekend rule in force on that
  date. Sharjah is flagged on the page as the city whose weekend moved.

### The look: mockup B as the system

- **Space-dark everywhere.** Black space (`#000`) behind the Earth, deep night surfaces for
  reading, starlight ink (`#eef1f6`), dim text (`#aab3c0`), pen glow (`#9cc8ff`), and the
  existing diverging quiet/loud ramp (dark variant). The light "chart paper" theme is retired,
  so there is one theme (agreed: "the rest of the site moves to the same dark look").
- **Type:** Gloock for display (questions, answers, big readouts); Schibsted Grotesk for
  everything read or tapped. Both from Google Fonts. These replace Old Standard TT and Libre
  Franklin site-wide.
- **The memorable element** is the glowing pen line over the Earth. Everything around it stays
  quiet: no card boxes, few rules, generous space.
- Clear wayfinding: one menu (Ask, Globe, Today, Game, Research, About), the same on every
  page; the current page is marked; the Ask entry is visually first.

### Millimetre lines

One shared helper in `common.js` draws chart paper as SVG patterns, aligned to the chart's
own axes:
- the finest line every 12 minutes (one fifth of an hour) across, and five steps per level
  band up;
- a firmer line every hour;
- the firmest every six hours.

Hairline widths use `vector-effect: non-scaling-stroke`, so lines stay crisp at any size and
pixel density. Every chart (Ask, tour, Today, game, globe calendar) uses it. Pen lines are
smoothed with a Catmull-Rom curve that passes through every real hourly point, so no value
changes. They are drawn with round caps, and with the glow on dark.

### Sound

`site/sound.js`, loaded on every page, synthesised with the Web Audio API: no audio files, no
licences, a few kilobytes.
- **Ambient:** a slow, low drone of a few detuned voices through a soft low-pass and a
  generated reverb, breathing over minutes. Very quiet by default.
- **Whoosh:** filtered noise swept and panned, for Earth zooms and turns and for page changes.
- **Pen-scratch:** a soft, short texture while a line draws.
- **Chime:** two quiet notes when an answer appears.
- **Tick:** a light, short sound for buttons and calendar squares.
- **Control:** a "Sound on/off" switch in the bar on every page, remembered in `localStorage`.
  Sound starts only after the visitor's first click or key press (the browser rule), fades
  when the tab is hidden, and is simpler when `prefers-reduced-motion` is set. No information
  is carried by sound alone.

### Follow-through

- Tests, real data only: the Ask files exist and parse; every day's fold excludes its own
  week; the probabilities sum to about 100; the scores table matches the files; `sound.js`
  and the same menu are on every page; there is still no `innerHTML`.
- Docs: Result 16 in docs/04, README (headline, features, screenshots), CHANGELOG 1.4.0,
  work log, CLAUDE.md (Ask data, sound, the single theme), and docs/02 for the new fonts if
  that is where sources live.
- README media: re-capture the screenshots, the GIF and the demo video, so they show the new
  design.
- Check every page in Playwright at desktop and phone width with no console errors, run
  pytest, then commit with the trailers.

## Left to the builder

- The exact sound recipes (frequencies, envelopes, levels), within "calm, quiet, premium".
- The exact transition choreography (timings and easing) of calendar to year view, and of the
  Earth zoom.
- Where the 2019-20 tour quiz and the game draw their days from, as long as every guess shown
  is out-of-fold.
- Phone layouts: the year calendar may scroll sideways, or switch to one month per row, on
  narrow screens.
