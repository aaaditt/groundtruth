# 13. Final report

**Learning Urban Activity Rhythms from Ambient Seismic Noise for Anomaly-Based
Disruption Detection**

Aadit Chandra, Aradhya Gupta, Shraddha Pradeep · Foundations of Data Science, BITS Pilani

Live tool: https://aaaditt.github.io/groundtruth/ · Code and data:
https://github.com/aaaditt/groundtruth

Every number below comes from a script in `src/` run on real data, and links to its
full result in [`04-results.md`](04-results.md) (R1 = Result 1, and so on).

---

## Abstract

Seismometers record earthquakes, but between quakes they record people: traffic,
trains and footsteps shake the ground by nanometres at 4–14 Hz. Using the published
recordings of 158 seismometers from Lecocq et al. (2020), we trained one random forest
per city to read the day of the week from one day of ground vibration, testing only on
whole weeks the model had never seen. Weekday vs weekend is recognised with **94.9%
median balanced accuracy** across 149 cities, and the exact weekday at **47.3%** (chance
14.3%). Never shown a holiday, the models called **75.6% of weekday public holidays a
"weekend"**, against 5.6% of ordinary weekdays. A pre-registered natural experiment
found that when the UAE moved its weekend in 2022, **Sunday got 20% quieter** at a UAE
seismometer (p = 0.003, placebo year null). On current data the method still works
(98–100% in five cities, Oct 2025 – Sep 2026), and it now runs as a public dashboard,
**City Pulse**, that scores each new day automatically and grades predictions made in
advance.

---

## 1. Question

Can the hum of a city, recorded by instruments built for earthquakes, tell us:
1. **what day of the week it is**, and
2. **when a day breaks the city's normal rhythm** (holidays, lockdowns, events)?

If yes, every public seismometer becomes a free, privacy-preserving sensor of human
activity.

## 2. Data

- **Main data:** Lecocq et al. (2020), *Science*, doi:10.1126/science.abd2438. 15-minute
  4–14 Hz displacement RMS for 158 stations worldwide, Oct 2019 – mid 2020, with
  Table S1 (city, coordinates, time zone, lockdown dates). After cleaning:
  **28,749 station-days**, of which **17,027 are normal days** (R1, `docs/03`).
- **Recent data:** EarthScope MUSTANG hourly noise spectra (Casey et al. 2018,
  doi:10.1785/0220170191), converted to the same quantity. Validated against the
  published data on 6 stations before use (`docs/11`). **Never mixed with the
  published data in one model.**
- **Calendars:** weekend days per country with sources (`config/weekends.csv`); public
  holidays from the `holidays` package 0.108.

## 3. Method

Each local day becomes **25 numbers**: the **shape** of its 24 hours (each hour minus
the day's mean, so sensor units cancel) and its overall **level** (robust z-score
against the station's own normal days). Models: random forests (scikit-learn, 100
trees, class-balanced); logistic regression as a check.

**Safeguards against fooling ourselves** (`docs/03`, Step 5):
- **Whole weeks held out** in cross-validation, since neighbouring days are alike.
- **Balanced accuracy**: a model that always says "weekday" scores 50%, not 71%.
- **Train only on normal days**: holidays, the Christmas season and lockdowns are never
  in training, so detecting them is genuinely out-of-sample.
- **Cities held out** for the global model.
- **Normal days scored out-of-fold** in the detectors, including their median/MAD
  reference statistics (a bug we found and fixed; R8).
- **Pre-registration** before the UAE experiment and the live predictions.
- **Natural controls**: remote towns (R2) and the ocean-wave frequency band (R12).

## 4. Results

### 4.1 The weekly rhythm is readable (R1–R3, R5, R6)

| | Result | Chance |
|---|---|---|
| Weekday vs weekend, median of 149 cities | **94.9%** (105 cities ≥ 90%, 19 at 100%) | 50% |
| Exact day of week, median | **47.3%** (best: Dombås 73.9%, Athens 69.6%) | 14.3% |
| One global model, tested on **unseen cities** | **83.0%** / 30.5% | 50% / 14.3% |
| Remote control towns (Mammoth Lakes, Puerto Williams, Kule) | 48.0%, 56.4%, 59.0% | 50% |

- **Accuracy rises with population density** (Spearman ρ = 0.39), and remote towns
  sit near chance, as they must if the signal is human.
- **When the day is busy matters more than how busy.** The 24-hour shape adds
  +5.5 points (weekday vs weekend) and **+17.2 points (exact day)** over loudness alone (R6).

### 4.2 Holidays sound like weekends (R4, R7, R8)

Never trained on a holiday, the models called **75.6%** of weekday public holidays
"weekend" (n = 634), against **5.6%** of ordinary weekdays. By type: New Year 90%,
Christmas/Easter 85%, other religious 67%, civic 57%, bridge days 49% (R7). US federal
holidays where most people work stay weekday-like (Veterans Day 19%).

As a detector, **model confusion** (1 − probability of the true weekday) finds public
holidays with a median PR-AUC of **0.63**, against 0.33 for an unsupervised anomaly
score (chance 0.04), and is better at 110 of 147 stations (R8).

### 4.3 Lockdown was not a long Sunday (negative result)

Only **26%** of lockdown weekdays were called "weekend", but 35% of lockdown days were
flagged as anomalous. Lockdown created a new, flatter rhythm that matched neither a
weekday nor a weekend: the anomaly detector catches more of it, the classifier less.
Supervised and unsupervised methods answer different questions.

### 4.4 Transfer across cultures (R9)

A model trained only on Saturday–Sunday countries **heard Friday as the weekend in
Salfit (Palestine) and Amatzia (Israel)**, and their Sundays as working days. Jeddah is
called weekend every day, for reasons we cannot establish. Transfer failure tracks the
city's own accuracy (ρ = 0.76), more than density or latitude.

### 4.5 A pre-registered natural experiment (R10, `docs/14`)

On 1 Jan 2022 the UAE moved its weekend from Friday–Saturday to Saturday–Sunday. We
committed the hypothesis, window, exclusions and test before downloading data.

| | Change vs Mon–Thu | p (exact permutation) |
|---|---|---|
| **Sunday (primary)** | **−20%** | **0.003** |
| Sunday, placebo year | +5% | 0.73 |
| Saturday (rest day both periods) | −3% | 0.52 |
| Friday (no prediction) | +53% | 3 × 10⁻⁶ |

**Verdict: supported.** Friday's rise was not predicted and is reported as such. The
station's official coordinates turned out to be ~90 km east of Sharjah city, which
limits how Friday can be interpreted but not the Sunday test.

### 4.6 Frequencies (R12)

On recent MUSTANG data, the ocean-wave band (0.1–1 Hz) gives **51.4%** (chance), and the
4–14 Hz band is best (median **98.6%** / 58.1%). This is a clean natural control: the
model finds the weekly rhythm only where people make noise.

## 5. The tool: City Pulse (R11, R13)

Per-city models trained on **1 Oct 2025 – 30 Sep 2026** of MUSTANG data score
98–100% (weekday vs weekend) in Brussels, Los Angeles, Melbourne, Dublin and Montreal.
A GitHub Action runs every day:
download → score each new day → commit the results → publish
https://aaaditt.github.io/groundtruth/.

- **Each city card:** which weekday the day looked like, an unusual-day flag, a
  timeline, and the **live track record** on days the model never saw.
- **Predictions board:** 18 predictions for upcoming holidays, committed in advance
  and graded automatically.
- **Guess the day:** a game against the model's honest held-out guesses.
- **Research map** of all 158 stations.
- **Open dataset:** `site/data/pulse_days.csv`.

First month (snapshot 2026-11-04): 100% weekday vs weekend in four cities; Dublin's
October Bank Holiday was called Sunday and flagged; Montreal is drifting (25% of days
flagged).

## 6. Limitations

- Published data covers ~6 months per station; exact-day accuracy is limited by ~16
  examples of each weekday.
- Holidays are national calendars only; regional ones (Quebec, Victoria) are missed.
- Weekend labels for Monday–Saturday countries involve judgement (`config/weekends.csv`).
- One-day-weekend stations (La Paz, Nepal) show no weekly signal.
- The UAE experiment is one station and one change.
- Live models are not retrained automatically; stations go offline (New York).
- Most of the "most confusing" days in the showcase cities remain unexplained.

## 7. Ethics

The signal is the combined vibration of a whole neighbourhood, summarised per hour. It
cannot identify, locate or follow a person, and we don't try. All data is public and
cited; the tool says "no data" rather than estimating when a station is down.

## 8. Reproducibility

`./run_all.sh` rebuilds every number. 59 tests run on real data only; CI rebuilds the
dataset on a clean machine and fails if any label or value changes. Random seeds are
fixed. The full history, including mistakes and the bugs we caught, is in
[`07-build-log.md`](07-build-log.md) and [`10-work-log.md`](10-work-log.md).

## References

- Lecocq, T., Hicks, S. P., Van Noten, K., et al. (2020). Global quieting of
  high-frequency seismic noise due to COVID-19 pandemic lockdown measures. *Science*
  369(6509), 1338–1343. doi:10.1126/science.abd2438
- Casey, R., et al. (2018). Assuring the Quality of IRIS Data with MUSTANG.
  *Seismological Research Letters* 89(2A), 630. doi:10.1785/0220170191
- Díaz, J., Ruiz, M., Sánchez-Pastor, P. S., & Romero, P. (2017). Urban seismology: on
  the origin of earth vibrations within a city. *Scientific Reports* 7, 15296.
  doi:10.1038/s41598-017-15499-y
- Groos, J. C., & Ritter, J. R. R. (2009). Time domain classification and quantification
  of seismic noise in an urban environment. *Geophysical Journal International*
  179(2), 1213–1231.
- Full source list with network DOIs: [`02-data-and-sources.md`](02-data-and-sources.md).
