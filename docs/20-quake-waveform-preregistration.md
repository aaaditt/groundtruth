# 20. Pre-registration: subtract the people, second by second

**Written 2026-11-24, before any waveform was downloaded and before any code for this test
was written.** Sections 1–6 are fixed. Anything decided after the first run is labelled
**exploratory** in `docs/04-results.md` (Result 22). Amendments, if any, are added at the end
with their date and whether any detection result had been seen.

> This is about **detecting** small earthquakes that have already happened in a noisy
> record. It is not earthquake **prediction**, which nobody can do.

## 0. Why a second test

Result 19 (`docs/17`) asked the same question on the paper's **15-minute** averages and
found no significant gain (p = 0.053), with the whole lead coming from one station in a
Puerto Rico earthquake swarm. Its own conclusion named the honest next step: a small
earthquake lasts **seconds**, so it needs the **second-by-second recording** (the waveform),
not 15-minute summaries. This is that test, on years Result 19 never touched.

## 1. Question

At the same false-alarm rate, does comparing each second of the recording with what the
city **normally sounds like at this hour on this weekday** find more catalogued earthquakes
than a fixed threshold on the raw recording?

## 2. Data (all real, all public)

- **Stations:** the 33 stations of the time-travel globe (`src/history.py` `roster()`),
  positions from `outputs/tables/history_station_coords.csv` (FDSN station service), the
  roster's channel. A station is dropped if its sampling rate is below 40 per second (the
  band reaches 14 Hz).
- **Period:** **1 Jan 2021 – 30 Sep 2026**. Only ordinary days (`baseline`: not a public
  holiday, not 21 Dec – 6 Jan, by the station's national calendar).
- **Waveforms:** EarthScope FDSN dataselect, cached under `data/cache/waveforms/`. Each
  window is corrected by the overall sensitivity from the station's StationXML, converted
  to **displacement** (integrated once for velocity sensors, twice for accelerometers),
  band-passed **4–14 Hz** (zero-phase Butterworth, 4 poles), and summarised as the **RMS
  of each 1-second step**: `x(s) = log10(RMS)`. Windows with gaps are dropped and counted.
- **Normal level ("the people"):** the MUSTANG hourly spectra already in
  `data/cache/mustang/`, as 4–14 Hz displacement RMS (`groundtruth.mustang.band_rms`), the
  same numbers the globe uses.
- **Earthquakes:** USGS ComCat (FDSN event service), downloaded once and cached.

## 3. The three detectors

For one 1-second step at time *s*:

| Detector | Score | What it stands for |
|---|---|---|
| **raw** | `x(s)` | a fixed threshold, the same at 3 a.m. and at rush hour |
| **rolling** | `x(s)` − median of `x` over the **300 seconds before** the window | adaptive, learns nothing |
| **learned** | (`x(s)` − *m*) / max(*k*, 0.01), where *m* and *k* are the median and 1.4826 × MAD of log10 MUSTANG RMS for **the same station, weekday and local hour over the previous 8 weeks** (ordinary days only, at least 6 values, else the window is dropped) | "subtract the people": what this city usually sounds like right now |

The learned normal uses only days **before** the window, so it never sees the window. Units
differ between the MUSTANG and waveform numbers; that offset is the same for every window
of a station and is absorbed by the per-station threshold (section 4).

**Detection window:** 90 seconds from the event's origin time (at 100 km the S wave
arrives after about 30 s). A window's score is the **highest** 1-second score in it.

## 4. Matched false-alarm rate

- **Quiet chunks:** 100 per station, 15 minutes long, at random times (seed 0) on ordinary
  days in the period, each more than 1 hour from any catalogued event with M ≥ 1.5 within
  100 km, M ≥ 4.5 within 1000 km, or M ≥ 6.5 anywhere (Result 19's quiet rule). If a chunk
  has no data, the next random time is drawn, up to 300 tries per station.
- Each chunk gives **6** quiet windows of 90 s (the first 5 minutes serve as the rolling
  detector's history), scored exactly like event windows.
- **Threshold**, per station and detector: the **99th percentile** of its quiet-window
  scores. Each detector then raises a false alarm in about 1% of quiet 90-second windows.
  Thresholds use no earthquake labels.

## 5. Primary test and success criterion

- **Events:** ComCat events with **M ≥ 2.0**, epicentre **≤ 100 km**, origin on an ordinary
  day in the period, with all three detectors scored. **At most 100 events per station**,
  chosen at random (seed 0) when there are more, so that no single swarm decides the result
  (the lesson of Result 19). An event seen by two stations counts twice.
- **Primary test:** exact two-sided McNemar test, **learned vs raw**, pooled over stations.
- **Success:** learned finds more events than raw **and** p < 0.05.
- **Inconclusive:** if fewer than 20 events are found by any detector.
- **Secondary (reported, not the headline):** rolling vs raw and learned vs rolling (same
  test); the result without the station that contributes the most events; found events by
  magnitude band (2–3, 3–4, ≥ 4) and distance band (0–30, 30–60, 60–100 km).

## 6. What we expect, written before running

Seconds should find far more events than 15-minute averages did, for every detector. Whether
"learned" beats "raw" is open: it should help most at busy urban stations in the daytime,
where the raw threshold is set by rush-hour noise. A null or negative result is a real
answer and will be reported as one.
