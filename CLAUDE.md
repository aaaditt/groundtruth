# CLAUDE.md — instructions for AI coding agents

Read `README.md` and `docs/04-results.md` before changing anything.

## What this project is

Course project for Foundations of Data Science, BITS Pilani, presented **22 Sep 2026**.
Registered title: *Learning Urban Activity Rhythms from Ambient Seismic Noise for
Anomaly-Based Disruption Detection*. Team: Aadit Chandra, Aradhya Gupta, Shraddha Pradeep.

It predicts the day of the week from ambient seismic noise, and flags days that break a
city's normal rhythm, using real data from Lecocq et al. (2020), *Science*.

## Hard rules

1. **Real data only.** No synthetic, simulated or generated data anywhere — not for
   tests, not for demos, not for filling gaps. Every number that reaches a slide must
   come from a script in `src/` run on the real dataset. An earlier synthetic prototype
   was deliberately deleted; don't reintroduce one.
2. **Keep the evaluation honest.** Train only on `period == "baseline"` days. Keep
   `GroupKFold` by week (per-station) and by station (global). Report balanced accuracy
   for weekday vs weekend. Never tune on holiday or lockdown days and then report
   detection performance on them.
3. **Cite every source.** New data or literature goes in `docs/02-data-and-sources.md`
   with a link and a DOI.
4. **Update the docs with the code.** If a number changes, change it in
   `docs/04-results.md` and `README.md` too. Stale numbers in the docs are worse than no
   docs — this repo is the presentation's evidence.
5. **Explain as you go.** The people maintaining this are new to ML. Say what you're
   changing and why, run the script, show the output. Small steps. Keep comments
   beginner-friendly.

## Current state — all verified by running on real data

Pipeline: `get_data.py` → `build_dataset.py` → `train_stations.py` / `train_global.py` /
`showcase_city.py` / `detect_disruptions.py`; Stage 4 adds `class_weight_check.py`,
`shape_vs_level.py`, `score_days.py` → `confusion_detector.py` / `holiday_holdout.py`,
`transfer.py` and `uae_experiment.py`; `train_live.py` (live models, MUSTANG,
Oct 2025 – Sep 2026, `groundtruth/live.py`); `predict.py` for the live demo; `run_all.sh`
runs the lot (~30 min).
Shared logic lives in the `groundtruth/` package (features, calendars, models, stations);
`src/` holds the experiment scripts. Run `pytest -q` before committing; CI also rebuilds
`daily_features.csv` and fails if it changes. Headline numbers are in `README.md`; full results in
`docs/04-results.md`.

## Gotchas already solved — do not undo these

- `Table S1` is **latin-1 encoded**, not UTF-8.
- `tzdata` is a required dependency (time zones like `US/Pacific` fail without it).
- Stations store amplitude in **different units** (metres vs nanometres). Only compare a
  station against itself, or compare day *shapes*. Plots say "× typical level at this
  station" for this reason.
- Sensor glitches (near-zero and huge values) are filtered in `groundtruth/features.py`, and
  `build_dataset.py` / `detect_disruptions.py` use **robust statistics** (median/MAD,
  z-scores clipped at ±10). Removing this brings back anomaly scores in the thousands.
- Timestamps must be converted to **local** time before hourly aggregation.
- `train_stations.py` takes ~5–8 minutes (149 stations × 10 forest fits). That's normal.
- The per-day normalisation (shape = hourly values minus the day's mean) exists to stop
  the model learning sensor loudness instead of human activity. Don't remove it to
  "improve" accuracy.

## What to work on next

See `docs/12-master-plan.md` and the "Next steps" at the end of `docs/10-work-log.md`.
The five promises (Results 5–9 in `docs/04`) and the pre-registered UAE experiment
(`docs/14`, Result 10) are done, and so are the live models (Result 11) and the City
Pulse dashboard (`site/today.html`, `src/pulse.py`, `.github/workflows/pulse.yml`, live at
https://groundtruth-seismic.vercel.app/today.html; the front page `site/index.html` is a
scrolling tour, `tour.js`), the band test (Result 12), the research map,
game and predictions board, and the final report (`docs/13`). Tagged `v1.0-semester`.
After the tag: 2019–2026 history (Result 14 lockdown cross-check, `src/history_pilot.py`)
and the time-travel globe (Result 15, `src/history.py`, `groundtruth/history.py`,
`site/globe.html`, MapLibre + OpenFreeMap).

- Station coordinates for anything new come from the FDSN station service, not Table S1:
  Table S1 puts II.NIL (Nilore) in Paraguay and IU.DAV (Davao) in Malaysia.
  `outputs/tables/history_station_coords.csv` holds the checked values.
- The globe's colour is "vs the same weekday over the previous 8 weeks", deliberately not
  vs a fixed year: stations drift over years (Sharjah's level jumps 1.5× for months).
- `groundtruth/mustang.parse` is the fast one-read_csv parser; it must stay bit-identical
  to `_parse_per_spectrum` (tested).

- `config/predictions.csv` is pre-registration: never edit or delete a row after its
  commit. Add new predictions as new rows, committed before their date.

- The site is served by **Vercel** as plain static files from `site/` (`vercel.json`: no
  build, `Cache-Control: max-age=0, must-revalidate`); every push to `main` redeploys.
  GitHub Pages (pulse.yml) is still a mirror until it is retired.
- `site/data/` is written by the daily Action; don't hand-edit it. New days are scored
  with period = "live" so they can never enter training.
- Dashboard JS builds DOM with `textContent` only (no innerHTML with data).

- Live data uses `week_id()` (year + week), never the bare week number.
- The MUSTANG cache is gzip (`.txt.gz`); `outputs/tables/live_days.csv` is saved at full
  precision (rounding changed a forest split).

## Stage 4 notes — do not undo

- `make_model()` / `make_global_model()` use `class_weight="balanced"` on purpose
  (matches balanced accuracy). Before/after: `src/class_weight_check.py`.
- `groundtruth/detect.py` scores NORMAL days out-of-fold (models AND median/MAD from
  other weeks). Scoring them in-sample makes every detector look better than it is.
- `load()` must keep Namibia's country code "NA" (pandas reads it as missing by
  default). Read any CSV with a `country_code` column through `load()`.
- `docs/14-uae-preregistration.md` sections 1–6 are frozen. Never change the window,
  metric or exclusions in `src/uae_experiment.py`; add new analyses as EXPLORATORY.

## Conventions

- Python 3.11+, scikit-learn, pandas, matplotlib. No deep learning frameworks — the
  per-station sample size (~115 days) doesn't justify them.
- Plots go to `outputs/plots/` at dpi=150 and must be legible on a projector.
- Fixed random seeds (`random_state=0`) so results stay reproducible.
- Don't commit `data/external/` (~440 MB) or `outputs/models/` (regenerable).
