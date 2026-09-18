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
`showcase_city.py` / `detect_disruptions.py`; `predict.py` for the live demo;
`run_all.sh` runs the lot (~15 min). Headline numbers are in `README.md`; full results in
`docs/04-results.md`.

## Gotchas already solved — do not undo these

- `Table S1` is **latin-1 encoded**, not UTF-8.
- `tzdata` is a required dependency (time zones like `US/Pacific` fail without it).
- Stations store amplitude in **different units** (metres vs nanometres). Only compare a
  station against itself, or compare day *shapes*. Plots say "× typical level at this
  station" for this reason.
- Sensor glitches (near-zero and huge values) are filtered in `features.py`, and
  `build_dataset.py` / `detect_disruptions.py` use **robust statistics** (median/MAD,
  z-scores clipped at ±10). Removing this brings back anomaly scores in the thousands.
- Timestamps must be converted to **local** time before hourly aggregation.
- `train_stations.py` takes ~5–8 minutes (149 stations × 10 forest fits). That's normal.
- The per-day normalisation (shape = hourly values minus the day's mean) exists to stop
  the model learning sensor loudness instead of human activity. Don't remove it to
  "improve" accuracy.

## What to work on next

See `docs/08-roadmap.md`. In priority order: validate anomaly flags against real public
holiday calendars (`holidays` package) to get precision/recall; a station map; a
logistic-regression baseline for comparison; a frequency-band ablation. Live FDSN data
and anomaly typing are future work.

## Conventions

- Python 3.11+, scikit-learn, pandas, matplotlib. No deep learning frameworks — the
  per-station sample size (~115 days) doesn't justify them.
- Plots go to `outputs/plots/` at dpi=150 and must be legible on a projector.
- Fixed random seeds (`random_state=0`) so results stay reproducible.
- Don't commit `data/external/` (~440 MB) or `outputs/models/` (regenerable).
