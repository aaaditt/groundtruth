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

`src/build_dataset.py` tags every station-day with a `period`. When more than one
applies, the first row in this table wins:

| Period | Definition | Role |
|---|---|---|
| `lockdown` | On or after the city's official COVID lockdown start date (Table S1) | Held out: a known disruption |
| `holiday` | An official **public holiday** in that country (national calendar) | Held out: a known disruption |
| `festive` | 21 Dec – 6 Jan (Christmas / New Year season), on days that aren't public holidays | Held out: kept separate so the original comparison can still be shown |
| `baseline` | Everything else | **The only days models ever train on** |

Result: **158 stations, 28,749 station-days**, of which **17,027** are baseline days
(roughly 108 normal days per station). 1,127 station-days are public holidays (735
of them before lockdown; the rest fall inside lockdowns and are labelled `lockdown`).

*History:* before 2026-11-03, `holiday` meant only the 21 Dec – 6 Jan window, and other
public holidays (Thanksgiving, All Saints' Day, ...) were wrongly counted as normal
training days. See `docs/10-work-log.md`.

### Weekend labels

Not every country rests on Saturday and Sunday. `is_weekend` comes from
`config/weekends.csv`, applied by `src/calendars.py`. The rule we use:

> **The weekend is the set of days outside the country's standard workweek, as given
> by the cited source.**

The source is Wikipedia's *Workweek and weekend* table, pinned to the revision of
31 Dec 2019 (the middle of our recordings), so it describes the rules in force during
the data period. For countries that revision doesn't list, we used the current
revision. Departures from Saturday–Sunday in our data:

| Weekend | Countries (stations) |
|---|---|
| Friday–Saturday | Saudi Arabia, Israel |
| Friday only | Iran, Palestine |
| Saturday only | Nepal |
| Sunday only (standard workweek Monday–Saturday) | India, Hong Kong, Mexico, Bolivia, Honduras |

Rules carry a `valid_from` date because they change: the UAE moved from
Friday–Saturday to Saturday–Sunday on 2022-01-01 (no UAE station is in this dataset,
but the rule is there for the recent-data work).

**Known limits.** The labels are judgement calls in places. "Sunday only" for India or
Mexico follows the source, but many offices there also close on Saturday. Colombia,
Pakistan and the Philippines are listed as Monday–Friday, with notes that many
businesses open Saturday. Countries the source doesn't list (Andorra, Aruba, Barbados,
Bermuda, Botswana, Cape Verde, Cyprus, Ecuador, El Salvador, Falklands, Faroe Islands,
Georgia, Guam, Haiti, Iceland, Moldova, Namibia, Panama, Papua New Guinea, Peru,
Puerto Rico) are assumed Saturday–Sunday. Each row's reasoning is in the `note` column
of `config/weekends.csv`.

**Labels never come from the seismic data.** Deciding "Friday is the weekend here"
because Fridays look quiet would grade the model with its own answers.

### Public holidays

Public holidays come from the `holidays` Python package (national calendars; English
names where available). We use a regional calendar only where Table S1 itself names a
region (Scotland, Sabah). Regional holidays elsewhere, such as Swiss cantonal or US
state holidays, are **not** included, so a few regional holidays may still sit in the
training data. Table S1's country codes have a few errors, corrected in
`config/country_fixes.csv` (for example, Namibia's code `NA` is read by pandas as a
missing value).

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

We also never train on public-holiday, festive-season or lockdown days, so the
disruption results below are genuinely out-of-sample.

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
