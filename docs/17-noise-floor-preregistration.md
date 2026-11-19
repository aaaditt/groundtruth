# 17. Pre-registration: does subtracting the learned human noise reveal small earthquakes?

**Written 2026-11-19, before any earthquake catalogue was downloaded and before the
analysis script was run.** This is the research spike from `docs/08-roadmap.md` item 8
and `docs/12-master-plan.md` Phase 6.3 (slide "06 · Subtract the people, see what's
underneath", and "The loop"). Sections 1–5 are fixed. Anything decided after the first
run is labelled **exploratory** in `docs/04-results.md`.

> This is about **detecting** small earthquakes that have already happened in a noisy
> record. It is not earthquake **prediction**, which nobody can do.

## 1. Question

At the same false-alarm rate, does a detector that compares each moment with the
station's **learned normal** for that hour and weekday find more catalogued earthquakes
than a **fixed threshold** on the raw record?

## 2. Data (all real, all public)

- **Ground noise:** the paper's raw 15-minute RMS, 4–14 Hz band
  (`PaperZero_RMS/*.csv`, Lecocq et al. 2020). *Not* `daily_features.csv`: its hourly
  medians and its 100×-above-median glitch filter remove exactly the short loud bursts
  an earthquake makes. Only impossible values (≤ 0, non-finite) and drop-outs
  (< 1/100 of the station's median) are removed, and the same samples are given to
  every detector.
- **Days:** only `period == "baseline"` days (from `daily_features.csv`). Holidays,
  the festive season and lockdown are not used.
- **Station positions:** FDSN station service, choosing the epoch that covers
  15 Jan 2020 (EarthScope, then EIDA, then Raspberry Shake). Not Table S1.
- **Earthquakes (the ground truth):** USGS ComCat, FDSN event service
  (https://earthquake.usgs.gov/fdsnws/event/1/), downloaded once and cached.

## 3. The three detectors

Every score is computed on log10(RMS) for one 15-minute sample.

| Detector | Score | What it stands for |
|---|---|---|
| **raw** | the log-RMS itself | a fixed threshold, the same at 3 a.m. and at rush hour |
| **rolling** | log-RMS minus the median of the surrounding 2 hours | an adaptive threshold that learns nothing |
| **learned** | (log-RMS − median) / spread for this station, weekday and local hour, fitted on **other weeks** only (GroupKFold(5) by ISO week) | the learned, time-varying noise floor |

An event's score is the highest detector score within ±30 minutes of its origin time.

## 4. Matched false-alarm rate

- **Quiet samples:** more than 2 hours from any catalogued event that is within
  100 km (any magnitude), or M ≥ 4.5 within 1000 km, or M ≥ 6.5 anywhere.
- The same ±30-minute maximum is taken around every quiet sample. Each detector's
  threshold, per station, is the **99th percentile** of these quiet scores, so each
  detector raises a false alarm in about 1 % of quiet hours.
- Thresholds use no earthquake labels, only the definition of "quiet".

## 5. Primary test and success criterion

- **Primary events:** catalogued events with magnitude ≥ 2.0, epicentre ≤ 100 km from
  the station, origin time on one of that station's baseline days, with all detectors
  scored. One station–event pair counts once; an event seen by two stations counts
  twice.
- **Test:** exact two-sided McNemar test (binomial on the pairs that one detector finds
  and the other misses), **learned vs raw**, pooled over all stations.
- **Success:** learned finds more primary events than raw **and** p < 0.05.
- **Inconclusive:** if fewer than 20 primary events are found by any detector, the
  test is reported as inconclusive (too few events), not as a success or a failure.
- **Secondary (reported, not the headline):** learned vs rolling (same test); the same
  comparison at the 99.9th percentile; found events by magnitude and distance band.

A null or negative result is a real answer and will be reported as one.

### Amendment 1 (2026-11-19, before any detection result was seen)

The first test run stopped before scoring any earthquake: near Mammoth Lakes (NC.MCY)
the catalogue lists 6,218 events within 100 km in 7.5 months (~27 a day, mostly M < 1),
so "more than 2 hours from any event of any magnitude" left almost no quiet samples to
set thresholds. The quiet rule in section 4 becomes: more than **1 hour** from any
event with **M ≥ 1.5** within 100 km, or M ≥ 4.5 within 1000 km, or M ≥ 6.5 anywhere.
One hour is enough because an event's own score only looks ±30 minutes around it.
Nothing else changes.

## 6. "The loop": handing back a cleaner signal

`python src/noise_floor.py --export NET.STA` writes the station's whole 15-minute
record with its learned normal level and the residual, ready for anyone who wants the
record with the human rhythm taken out. For this export the floor is fitted on all
baseline weeks (it is a product, not an evaluation).
