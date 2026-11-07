# Pre-registration: can the ground name the exact weekday?

Written 2026-11-06, **before** any of the experiments below were run. Sections 1-5 are frozen
once committed: the results go in section 7 and never change what is written above it.

## Why this experiment

Result 16 (Ask the ground) reads weekday vs weekend at 93.1% (median over 33 stations) but the
exact weekday at only 47.4%. Its pooled confusion over ordinary days (counted 2026-11-06 from
`site/data/ask/*.json`, rows = true day, % guessed):

```
      Mo Tu We Th Fr Sa Su
Mo    44 14 12 11 10  5  4
Tu    17 28 16 17 14  5  3
We    14 17 30 16 14  5  3
Th    13 18 17 28 16  6  3
Fr     9 12 11 12 45  7  3
Sa     3  3  3  3  5 72 10
Su     2  2  1  2  2  8 83
```

Tuesday, Wednesday and Thursday sit near chance between themselves (33%). The team's goal is
90% exact-weekday accuracy. That number is an **aspiration, not a threshold**: it does not
change what is run or what is reported. Chasing a target by trying variants until one hits it
is how results become optimistic, so the full list of variants is fixed here and every one is
reported.

Result 16's models already train on about 1,800 days per station (the published per-station
models had about 115), so "more data" alone is not the lever. Two other levers are tested.

## 1. Data (fixed)

- The 33 stations of `src/history.py` `roster()`, 2019-01-01 to 2026-09-30, from the local
  MUSTANG cache (`data/cache/mustang/`, Casey et al. 2018, doi:10.1785/0220170191).
- Labels exactly as Result 16: `live.label_days` (holiday, festive, baseline, country weekends),
  the fixed lockdown window 2020-03-01 to 2020-06-30 as `period = "lockdown"`.
- Three displacement-RMS bands from each MUSTANG spectrum, computed like the existing 4-14 Hz
  band (`mustang.band_rms`): **1-4 Hz, 4-14 Hz, 14-20 Hz** (every station's spectra reach
  19.7 Hz or more; checked 2026-11-06).
- Cleaning as everywhere else (`features.clean_rms`, per band), local time before aggregation.
- A day needs at least 20 of 24 hours (as `daily_features`). Half-hour features need at least
  40 of 48 half-hours (the same 5/6 share); missing values are interpolated along the day.
- Per band: `shape` = log10 values minus the day's mean (unit-free, as everywhere in the
  project) and `level` = Result 16's `rolling_level` of that band's daily mean.

## 2. Part A: richer single-day features (fixed)

Eight configurations, each predicting the weekday from **one day only**:

| id | features | per day |
|----|----------|---------|
| A0 | 4-14 Hz, 24 hourly shape values + level (Result 16 exactly) | 25 |
| A1 | 4-14 Hz, 48 half-hourly shape values + level | 49 |
| A2 | 3 bands x 24 hourly shape values + 3 levels | 75 |
| A3 | 3 bands x 48 half-hourly shape values + 3 levels | 147 |

each with two models: **RF** = `models.make_model()` (the project's random forest) and **GB** =
scikit-learn `HistGradientBoostingClassifier(class_weight="balanced", random_state=0)` with
default settings. No hyperparameter tuning.

Evaluation exactly as Result 16: one model per station, trained only on `period == "baseline"`
days, GroupKFold(5) by `week_id`, every day predicted by the fold model that never saw its week.

**Common days.** All configurations are scored on the same days: baseline days that every
configuration can score at that station (so a feature set cannot win by dropping hard days).

## 3. Part B: a week of context (fixed)

The question changes from "which day is this one day?" to "given the week around it, which day
is the middle one?". This is a different claim and will always be reported as such.

- Input for day t: the per-day features of days t-3 ... t+3 (7 blocks in order), using the
  Part A configuration with the **highest median exact-day accuracy** (ties: fewer features).
  A missing neighbour is left missing (NaN).
- Model: `HistGradientBoostingClassifier(class_weight="balanced", random_state=0)` (it accepts
  missing values; the random forest does not).
- Folds: days are grouped into 28-day blocks counted from 2019-01-01; GroupKFold(5) on blocks.
  Because windows reach 3 days either side, a **training** day is dropped when any day of its
  window falls in a test block. Labels of neighbouring days are never inputs.
- Control **B0**: the same chosen single-day features, the same model and the same block folds,
  so the effect of the week is measured apples to apples.
- Trained on baseline target days only; scored on baseline days that both B0 and B can score.

## 4. Metrics (fixed)

- **Primary:** exact weekday accuracy on baseline days, median over stations.
- Secondary: pooled exact accuracy; accuracy on true Tuesdays, Wednesdays and Thursdays;
  weekday vs weekend balanced accuracy (country weekends, the rule in force on the date); the
  number of stations at 90% exact or better.
- The 7x7 pooled confusion matrix for A0, the chosen Part A configuration and Part B.

## 5. Decision rules (fixed)

- Part A **improves on Result 16** if the chosen configuration's median exceeds A0's by at
  least 3 percentage points **and** it is higher than A0 at 22 or more of the 33 stations
  (two thirds). Otherwise the verdict is "no meaningful improvement", reported as such.
- The chosen configuration is picked on the same data it is scored on, among 8. That makes its
  number slightly optimistic; the report says so and shows all 8.
- Part B **reaches the aspiration** if its median exact accuracy is 90% or more. Its gain over
  B0 is reported whatever it is.
- Nothing on the site changes as part of this experiment. Any later change to Ask is a separate
  decision, recorded in the work log.

## 6. Exploratory (labelled as such if run)

Anything not listed above (other bands, other models, tuning, pooling stations) is exploratory
and reported only under that heading, never as the result.

## 7. Results (added 2026-11-07, after the pre-registration commit `7cc7497`)

Run: `python src/weekday_experiment.py`. Tables: `outputs/tables/weekday_partA.csv`,
`weekday_partB.csv`, `weekday_confusion.csv`. 33 stations, 72,395 ordinary days scored by every
configuration.

### Part A: richer single-day features. Verdict: **IMPROVES on Result 16**

| config | median exact | pooled exact | median Tue-Thu | median weekday vs weekend |
|--------|-------------:|-------------:|---------------:|--------------------------:|
| A0-RF (Result 16) | 47.5% | 47.1% | 24.7% | 94.9% |
| A0-GB | 47.2% | 47.2% | 24.1% | 95.1% |
| A1-RF | 48.7% | 48.7% | 24.9% | 95.2% |
| A1-GB | 49.1% | 49.5% | 25.5% | 95.5% |
| A2-RF | 52.8% | 51.2% | 25.3% | 97.0% |
| A2-GB | 53.6% | 53.2% | 29.5% | 97.0% |
| A3-RF | 53.8% | 52.6% | 27.0% | 96.5% |
| **A3-GB** (chosen) | **56.7%** | **55.3%** | **31.5%** | **97.3%** |

The chosen configuration (three bands, half-hour detail, gradient boosting) gains **+9.2
points** over Result 16 and is better at **33 of 33** stations; both thresholds are met. The
extra frequency bands do most of the work (A0 to A2: +5.3), half-hour detail adds a little,
and gradient boosting helps most with the most features. It was picked among 8 on the same
data, so its number is slightly optimistic. Even so, Tuesday to Thursday stay hard: 38-41%
each, against 33% for a guess between the three. **No station reaches 90% from one day.**

### Part B: a week of context. Aspiration (90% median): **REACHED**

| config | median exact | pooled exact | median Tue-Thu | stations at 90%+ |
|--------|-------------:|-------------:|---------------:|-----------------:|
| B0, one day (A3 features, block folds) | 54.7% | 54.7% | 28.5% | 0 |
| **B, the week around the day** | **96.1%** | **91.2%** | **96.0%** | **25 of 33** |

Pooled, every weekday is named correctly 91-92% of the time (Result 16: 28-83%). Given the
week, the model finds the weekend and counts from it. 20 stations reach 95% or better; Hobart
reaches 100.0%. The weakest are the places with the least human activity, the same ones that
fail everywhere else in the project: Stanley (Falklands) 30.9%, Puerto Williams 62.7%, near
La Paz 64.6%, Nilore 65.9%, Port Blair 75.4%.

### What this does and does not show

- From **one day**, the exact weekday is still out of reach: Monday, Friday and the weekend
  are readable; Tuesday, Wednesday and Thursday are nearly the same day to the ground.
- From **a week**, the ground names the day almost always. This is a different question and
  must always be stated as such ("given the 7 days around it"). It is still honest: every
  guess comes from a model that never trained on that 28-day block, and no training window
  overlaps a test block.
- Nothing on the site was changed by this experiment (section 5).
