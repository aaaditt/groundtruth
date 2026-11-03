# 10. Work log — recent-data extension

Running record of what we do after the original build (`docs/07-build-log.md`). Newest
entries at the bottom. Only things that actually happened are recorded here; plans are
marked as plans.

---

## Part A — What we are doing and why

**Goal.** The project currently uses seismic data from 31 Oct 2019 to May 2020. We want
**recent data** (2021 onward) to answer two questions:

1. **Does the model still work on new data?** Train on the old normal days, test on
   recent days it has never seen. (Roadmap item 5.)
2. **The UAE weekend experiment.** On 1 Jan 2022 the UAE moved its weekend from
   Friday-Saturday to Saturday-Sunday. If our method measures human activity, the
   quietest days at a UAE station should shift with it. This is a natural experiment
   with a known date. (`docs/08-roadmap.md`, last section.)

## Part B — Where the data comes from

| Source | What it is | Used for | Reachable from our machine? |
|---|---|---|---|
| **Lecocq et al. (2020)**, GitHub `ThomasLecocq/2020_Science_GlobalQuieting` | Pre-computed 15-minute RMS ground motion, 4-14 Hz band, 173 stations, Oct 2019 - May 2020. doi:10.1126/science.abd2438 | All results so far (committed in `data/external/`) | n/a (already in repo) |
| **EarthScope (formerly IRIS)** FDSN web services, `service.earthscope.org` | Professional seismic networks, raw waveforms | Recent data for professional stations, UAE station `II.UOSS` | Yes (HTTP 200). Old `service.iris.edu` redirects (301) here |
| **Raspberry Shake** FDSN, `data.raspberryshake.org` | Citizen-science seismometers in homes/offices | Recent data for citizen stations in cities | Yes (HTTP 200) |
| **USGS** earthquake catalogue, `earthquake.usgs.gov` | Earthquake list | Only for roadmap item 8 (not planned now) | Yes (HTTP 200) |
| **SeismoRMS** (Lecocq), GitHub `ThomasLecocq/SeismoRMS` | The authors' method for turning waveforms into 15-min RMS | Method we copy so new data matches old data | n/a (code reference) |

The earlier build sandbox was blocked (HTTP 403) from all of these. From this machine
they are reachable (checked 2026-11-03).

**How raw data becomes our data.** Raw waveforms are huge, so recent data is converted
the same way the authors did it: download waveform, remove instrument response, band-pass
4-14 Hz, take RMS in 15-minute windows. Output has the same CSV layout as the old data
(a UTC timestamp column plus a `4.0-14.0` column), so the existing pipeline can read it.

## Part C — How the ML model works (current, unchanged)

All of this already exists and is verified; we are **not** changing it.

- **Features (25 per day).** Convert timestamps to the station's local time, take the
  hourly median of the 4-14 Hz RMS, subtract the day's mean to get a 24-number "shape",
  plus 1 number for overall level. The shape stops the model learning sensor loudness.
- **Model.** Random forest (scikit-learn, `random_state=0`), built in `src/common.py`.
- **Task 1: day of week.** Predict weekday vs weekend, and the exact day (7 classes).
- **Task 2: anomaly detection.** Flag days whose features lie beyond the 95th percentile
  of that station's normal days (robust median/MAD statistics). No labels needed.
- **Honest evaluation.** Train only on `period == "baseline"` days. Cross-validation holds
  out whole weeks (`GroupKFold`) per station, and whole stations for the global model.
  Never tune on holiday or lockdown days.
- **Current results** (see `docs/04-results.md`): weekday/weekend 93.3% median balanced
  accuracy over 149 stations (chance 50%); exact day 46.5% (chance 14.3%); unseen-city
  global model 79.0%.
- **How recent data will be used.** Recent days get their own label (`period == "recent"`)
  and are **test-only**. Model is trained on old baseline days and scored on recent days.
  A drop in accuracy would be reported honestly, not tuned away.

## Part D — Hard rules we keep

Real data only (no synthetic data anywhere); cite every source; update docs whenever a
number changes; keep the evaluation honest. Full list in `CLAUDE.md`.

---

## Log

### 2026-11-03 — Repo set up
- Cloned `https://github.com/aaaditt/groundtruth.git`, created `.venv`, installed
  `requirements.txt`. Python 3.11.9, scikit-learn 1.9.1, pandas 3.1.0.
- Ran `python src/predict.py --station AM.R7885 --date 2019-11-28`: guessed Sunday (68%),
  flagged unusual. Matches the README. Pipeline works.
- `.venv/` excluded locally via `.git/info/exclude` (not in `.gitignore`).

### 2026-11-03 — Plan agreed
- Plan: acquire recent data, check against old data, refresh stations, test on recent
  days, then the UAE experiment, then update docs. Decisions: do both goals; test all
  sources first.

### 2026-11-03 — Step 1: access check (done)
- EarthScope: 200 (IRIS address redirects 301). Raspberry Shake: 200. USGS: 200.
- `fdsnws.raspberryshakedata.com` did not respond; not needed.

### 2026-11-03 — Step 2: tooling (done)
- Installed `obspy` 1.5.1 in `.venv`. **Not yet added to `requirements.txt`**; will be
  added when `src/get_recent_data.py` exists and needs it.
- obspy's built-in `RASPISHAKE` shortcut failed service discovery even though the
  endpoints answer. Workaround: query the station service over plain HTTP (works), and
  configure the client with an explicit base URL when we write the download script.

### 2026-11-03 — Station availability findings (done, queried live)
- **`AM.R7885` (New York) stopped recording on 2021-06-21.** So it cannot give recent
  data. The flagship demo city can't be refreshed; recent-data test stations must be
  chosen from stations still online.
- **`BE.UCC` (Brussels)** and **`CN.MNTQ` (Montreal)** are still active on EarthScope
  (Brussels has a gap 2016-2018, resumes 2018-10-29).
- **`HL.ATH`, `FR.CURIE`, `CH.SGEV`, `NS.DOMB`** returned nothing from EarthScope. Likely
  held by other data centres (not yet checked). **Unresolved.**
- **UAE candidates:**
  - `II.UOSS` (University of Sharjah), EarthScope, running since 2009, still active. The
    only candidate that **spans the 1 Jan 2022 change**. Caveat: a university broadband
    station may sit somewhere quiet; whether it shows a human weekly rhythm is untested.
  - Raspberry Shake `AM.R1F39` (Dubai area, from 2023-10), `AM.R85A6` (Abu Dhabi, from
    2024-05), `AM.S994C` (Dubai area, from 2026-01). All start **after** the change, so
    they cannot show a before/after shift. They could still show the post-2022 weekend.
- Nothing has been downloaded yet and no recent-data numbers exist.

## Next steps (plans, not done)
1. Resolve which of the six showcase stations are available recent, and where.
2. Write `src/get_recent_data.py` (waveform -> 15-min RMS, same CSV layout), output to
   `data/recent/RMS/`.
3. Validate: re-pull an overlapping window for a station that is also in the old data
   (Brussels `BE.UCC` is the candidate, since New York is offline) and compare.
4. Test the old model on recent days; test whether `II.UOSS` shows a weekend shift.
5. Update `docs/02`, `docs/04`, `README.md` with sources and any results.
