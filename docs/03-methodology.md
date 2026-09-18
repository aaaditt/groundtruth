# 3. Methodology

How raw 15-minute vibration readings become a model that names the day of the week.
Every design choice below exists to stop the model from cheating.

## Step 1 — From 15-minute readings to one row per day

`src/features.py`

1. **Pick the band.** Read the `4.0-14.0` Hz column (human-activity band, per Lecocq
   et al. 2020). Stations without that column are skipped.
2. **Drop glitches.** Any 15-minute sample more than 100× above or below the station's
   own median is discarded. Sensor dropouts write near-zero values; clipping and
   spikes write huge ones. Both would wreck any average.
3. **Convert to local time.** Timestamps are UTC; we convert to the station's IANA time
   zone from Table S1. This matters enormously — averaging "8 a.m." across the world in
   UTC would blur every rush hour into noise.
4. **Take log10.** Seismic amplitudes span orders of magnitude, so we work in log space
   where differences are proportional rather than absolute.
5. **Median per local hour.** For each local calendar day we compute the median
   log-amplitude in each of the 24 hours. Median, not mean, so one passing truck or a
   small earthquake can't dominate an hour.
6. **Require a complete day.** Days with fewer than 20 valid hours are dropped; up to
   4 missing hours are filled by interpolating along the day.

## Step 2 — The 25 features

Each day becomes 25 numbers:

| Feature | What it is | Why |
|---|---|---|
| `shape_00` … `shape_23` | the day's 24 hourly log-values **minus that day's own mean** | Captures **when** the city was busy — the silhouette of the day. Subtracting the mean makes it comparable across stations with different sensor gains and units |
| `level` | the day's mean log-amplitude, expressed as a **robust z-score** (median/MAD) against that station's own normal days | Captures **how busy** the day was overall, in a way that only makes sense relative to the same station |

Why the split matters: absolute loudness depends on the sensor, its depth, its housing
and its distance from the nearest road. Shape is a behavioural fingerprint; level is a
station-relative measure. Mixing them naively would let the model learn "this station
is loud" instead of "this day is busy".

**Units warning (a real bug we hit):** stations store amplitude in different units —
some in metres (~1e-8), some in nanometres (~49). This is exactly why we never compare
raw amplitudes across stations, and why plots are labelled "× typical level at this
station" rather than in physical units.

## Step 3 — Labelling the calendar

`src/build_dataset.py` tags every station-day with a `period`:

| Period | Definition | Role |
|---|---|---|
| `baseline` | Before that city's official lockdown date, and not in 21 Dec – 6 Jan | **The only days models ever train on** |
| `holiday` | 21 Dec – 6 Jan (Christmas / New Year) | Held out — a known disruption to test against |
| `lockdown` | On or after the city's official COVID lockdown start date (Table S1) | Held out — a second known disruption |

Result: **158 stations, 28,749 station-days**, of which ~17,400 are baseline days
(roughly 115 normal days per station).

## Step 4 — The models

A **random forest** (scikit-learn `RandomForestClassifier`, 100 trees,
`min_samples_leaf=2`) — an ensemble of decision trees that each vote.

Why a random forest for a first real model:
- No feature scaling needed, and it handles non-linear patterns.
- Hard to break: few hyperparameters, little tuning, stable results.
- It reports **feature importance**, so we can see which hours of the day it relies on.
- With ~115 training days per station, a deep neural network would overfit instantly.

Two prediction tasks:
- **Weekday vs weekend** (2 classes, chance = 50%)
- **Exact day of week** (7 classes, chance = 14.3%)

And two scopes:
- **Per-station models** (`src/train_stations.py`) — one model per city.
- **One global model** (`src/train_global.py`) — trained on many cities at once.

## Step 5 — Testing honestly

This is where most student ML projects quietly cheat. Three safeguards:

1. **Whole weeks are held out, not random days.** `GroupKFold` grouped by ISO week
   number. Consecutive days are correlated (weather, roadworks, a broken sensor), so a
   random split would put Tuesday in training and Wednesday of the same week in the
   test set and inflate the score. The model never sees *any* day from the week it is
   tested on.
2. **Balanced accuracy for weekday vs weekend.** Weekends are only 2 days in 7, so a
   model that always says "weekday" scores 71% on plain accuracy while being useless.
   Balanced accuracy averages the per-class recall, so that lazy model scores 50%.
3. **For the global model, whole stations are held out.** `GroupKFold` grouped by
   station: it is always scored on cities that contributed zero training days. This
   answers a much harder question — does the rhythm generalise to a city the model has
   never seen?

We also never train on holiday or lockdown days, so the disruption results below are
genuinely out-of-sample.

## Step 6 — Disruption detection

`src/detect_disruptions.py` runs two independent detectors per station.

**Detector A — "does this weekday look like a weekend?"**
Take the weekday/weekend classifier trained on normal days, apply it to real *weekdays*
in each period, and measure how often it says "weekend". For normal days we use the
week-held-out cross-validated predictions, so the comparison is fair.

**Detector B — anomaly score (unsupervised).**
For each day type (Mon–Fri, Sat, Sun) compute the station's normal-days median and MAD
for all 25 features. A day's score is the root-mean-square of its robust z-scores
(clipped to ±10, so a single glitchy hour can't create a fake catastrophe). A day is
**flagged** if it scores beyond the 95th percentile of that station's normal days —
which fixes the false-alarm rate at 5% on normal days *by construction*, so any period
that exceeds 5% is showing a real effect.

Detector B never sees labels of any kind. It doesn't know what a holiday is.

## Reproducibility

`./run_all.sh` runs the whole chain: download → build dataset → per-station models →
global model → showcase plots → disruption detection. Roughly 15 minutes on a laptop.
Random seeds are fixed (`random_state=0`), so numbers should match `docs/04-results.md`
to the decimal.
