# 4. Results

All numbers below come from real data, produced by the scripts in `src/`, and are
reproducible with `./run_all.sh`. Every score is out-of-sample (see
`docs/03-methodology.md`, Step 5).

Dataset after cleaning: **158 stations, 28,749 station-days**; 149 stations had the
≥70 normal days required to train a per-station model.

> **Labels corrected 2026-11-03.** Weekends now follow each country's own calendar
> (Friday–Saturday in Saudi Arabia and Israel, Friday in Iran and Palestine, ...),
> and every official public holiday is removed from training and tested as a
> disruption. Previously, weekends were Saturday–Sunday everywhere and the only
> "holiday" was 21 Dec – 6 Jan. All numbers below are from the corrected labels. Old
> vs new values are logged in `docs/10-work-log.md`.

---

## Result 1 — A seismometer can tell weekdays from weekends

Per-station models, 5-fold cross-validation holding out whole weeks:

| Task | Median across 149 stations | Chance |
|---|---|---|
| Weekday vs weekend (balanced accuracy) | **94.6%** | 50% |
| Exact day of week (accuracy) | **47.0%** | 14.3% |

**65% of stations score ≥ 90%** on weekday vs weekend, and 22 score 100%.

![Accuracy across stations](../outputs/plots/accuracy_by_station.png)

Stations scoring 100% on weekday/weekend include Rundu (Namibia), Tegucigalpa,
Ann Arbor, Trondheim, Bergen, Thessaloniki, Milan, Naples, San José, Bucharest, Paris
(FR.CURIE), Geneva (CH.SGEV) and Montreal (CN.MNTQ).

Best stations for exact day of week: Dombås 71.3%, **Athens 70.4%**, Chapinero
(Bogotá) 70.2%, Albany 69.0%, Geneva 67.5%, **New York 67.0%**.

### Correct weekends make the signal appear

The stations whose weekend labels changed show what wrong labels had been hiding:

| Station | Country | Weekend (correct) | Before (Sat–Sun labels) | After |
|---|---|---|---|---|
| `AM.RFBE4` | Saudi Arabia (Jeddah) | Fri–Sat | 52.7% | **85.2%** |
| `IS.AMAZ` | Israel (Amatzia) | Fri–Sat | 72.8% | **96.9%** |
| `GE.SALP` | Palestine (Salfit) | Fri | 74.6% | **95.8%** |
| `IN.PBA` | India | Sun | 72.3% | **87.6%** |

The model was right all along; the labels were wrong. This is direct evidence the
model tracks when people actually rest, not a fixed calendar pattern.

### The showcase cities

| Station | City | Sensor type | Weekday vs weekend | Exact day |
|---|---|---|---|---|
| `AM.R7885` | New York | Raspberry Shake (citizen) | 100.0% | 67.0% |
| `HL.ATH` | Athens | Professional network | 98.4% | 70.4% |
| `BE.UCC` | Brussels | Professional (paper author's own station) | 100.0% | 47.0% |

Note that a ~$400 home seismometer in New York performs as well as research-grade
instruments. That is a good slide.

![New York weekly rhythm](../outputs/plots/AM_R7885_weekly_rhythm.png)

The New York plot is the core evidence, visible before any machine learning: Monday
through Friday rise sharply from about 6 a.m. and stay high; Saturday is clearly
lower; Sunday is lowest of all and rises latest.

![New York confusion matrix](../outputs/plots/AM_R7885_confusion.png)

The confusion matrix shows the model's characteristic error: it rarely confuses a
weekday with a weekend, but often confuses Tuesday with Wednesday or Thursday. That is
exactly what you'd expect — those days genuinely look alike to a seismometer, because
people behave the same way on them.

---

## Result 2 — The control group: no people, no signal

The bottom of the table is as informative as the top:

| Station | Location | Weekday vs weekend | Exact day |
|---|---|---|---|
| `NC.MLI` | Mammoth Lakes, USA (mountains) | 46.3% | 12.4% |
| `C1.MG01` | Puerto Williams, Chile (remote) | 50.1% | 13.5% |
| `BX.KOOLE` | Kule, Botswana (Kalahari) | 51.7% | 22.6% |

These sit at chance — as they must, if we are measuring human activity rather than
some artefact of the method. **This is the project's built-in sanity check.**

*Caution, new with the corrected labels:* a few stations now score **exactly 50.0%**
for a different reason. These are La Paz (Sunday-only weekend) and three Nepal
stations (Saturday-only). With a one-day weekend, only 1 day in 7 is a "weekend", and
the random forest falls back to answering "weekday" every time. That is a
class-imbalance limitation of the model, not proof of no signal. It is to be
addressed in the next modelling stage (class weighting), not tuned here.

And the effect scales with how many people are around: median weekday/weekend accuracy
is **91.9%** for the least dense third of stations, **92.7%** for the middle third and
**98.3%** for the densest third (Spearman ρ = 0.39, p = 9.5 × 10⁻⁷, n = 149, against
population density from Table S1; printed by `src/train_stations.py`).

---

## Result 3 — One model for cities it has never seen

`src/train_global.py` pools all normal days and is cross-validated by **station**, so
every test day comes from a city that contributed nothing to training.

| Task | Global model, unseen cities | Per-city models | Chance |
|---|---|---|---|
| Weekday vs weekend | **80.9%** | 94.6% | 50% |
| Exact day of week | **30.8%** | 47.0% | 14.3% |

(Global-model figures are pooled over all test days; the median per unseen station
is 84.1% for weekday vs weekend.)

Interpretation: the weekly rhythm of human activity is **partly universal** — a model
trained on Europe and the Americas transfers to a city it has never met and still beats
chance decisively. But each city has its own signature, and a local model is far better.
Cultural differences matter here: the working week is Mon–Fri in most of this dataset,
but not everywhere. Weekend labels now follow each country's calendar, but a model
pooled across countries still has to learn several different weekends at once.

---

## Result 4 — Disruption detection

Models trained **only on normal days**, then applied to public holidays, the Christmas
season and lockdown days they had never seen. Pooled over all station-days, 149
stations (`src/detect_disruptions.py`):

| | Normal days | Public holidays | Christmas season (non-holiday days) | COVID lockdown |
|---|---|---|---|---|
| Weekdays the model calls "weekend" | 2.7% (n=12,093) | **70.5%** (n=634) | 23.7% (n=1,270) | 20.2% (n=5,856) |
| Days flagged as anomalous | 5.3% *(≈5% by design)* | **46.2%** (n=705) | 16.5% (n=2,100) | **34.5%** (n=8,072) |

**Headline: on weekday public holidays the model said "weekend" 70.5% of the time,
against 2.7% for ordinary weekdays.** It never saw a holiday in training.

We report pooled rates because most stations have only 1–5 weekday public holidays
before lockdown, so a per-station median jumps between 0% and 100% (the per-station
medians are 2% / 100% / 12% / 10% for weekdays called weekend).

The pattern across holidays makes sense. Holidays when cities genuinely shut down are
called "weekend" most often: Christmas Day 85% (n=136), New Year's Day 91% (n=136),
Thanksgiving 84% (n=32), All Saints' Day 85% (n=20). US federal holidays when most
businesses stay open are not: Veterans Day 23% (n=31), Martin Luther King Jr. Day 31%
(n=32). A proper breakdown by holiday type (national, religious, bridge days) is
part of the next stage.

![Disruption detection](../outputs/plots/disruptions_global.png)

The ~5% normal-day flag rate is not a result. It is the threshold definition (95th
percentile of normal days). The result is that public holidays run at about 9× that
rate and lockdowns at about 7×.

![New York anomaly timeline](../outputs/plots/AM_R7885_timeline.png)

### Holidays discovered without being told

The anomaly score itself uses no calendar labels. Its five highest-scoring days outside
lockdown, per showcase city:

| City | Top anomalous days outside lockdown |
|---|---|
| New York | 1 Jan, 25 Dec, **Thanksgiving (Thu 28 Nov 2019)**, 24 Dec, Sat 25 Jan |
| Athens | 1 Jan, 25 Dec, **6 Jan (Epiphany)**, 26 Dec, Sat 28 Dec |
| Brussels | 1 Jan, 25 Dec, Sat 15 Feb, **1 Nov 2019 (All Saints' Day)**, Sat 29 Feb |

The top three or four in each city are official public holidays or Christmas Eve. The
unexplained Saturdays are listed as found; checking them against news is part of the
next stage.

### Live demo results (`src/predict.py`)

| Station, date | Actual | Model's guess | Flagged? |
|---|---|---|---|
| New York, 12 Feb 2020 | Wednesday | Tuesday (32%), wrong but adjacent | No |
| New York, **28 Nov 2019** (Thanksgiving) | Thursday | **Sunday (61%)** | **Yes** |
| New York, **25 Dec 2019** | Wednesday | **Sunday (97%)** | **Yes** |
| Brussels, **1 Nov 2019** (All Saints') | Friday | **Sunday (48%)** | **Yes** |
| Athens, 1 Apr 2020 (lockdown) | Wednesday | Tuesday (37%) | **Yes** |

---

## An honest negative result

**Lockdown did not make every day look like a Sunday.** Only 20% of lockdown weekdays
were classified as "weekend" (vs 70% of public-holiday weekdays), even though 35% of
lockdown days were flagged as anomalous.

Why: a holiday looks like a weekend because people genuinely do weekend things. A
lockdown created something new — much quieter overall, but with a flattened, home-bound
daily shape that matches neither a weekday nor a weekend. The anomaly detector
(which just measures "unlike normal") catches it; the weekday/weekend classifier
(which must choose one of two familiar patterns) does not.

This is worth saying out loud in the presentation. It shows the difference between
supervised classification and unsupervised anomaly detection, and it's a more
interesting finding than a clean win would have been.

---

## Limitations

- **Short baseline.** ~115 normal days per station. That is thin for a 7-class problem
  and is probably the main ceiling on the day-of-week accuracy.
- **One season.** The data covers Nov 2019 – May 2020 only, so seasonal effects are
  confounded with everything else.
- **National holidays only.** Public holidays use national calendars; regional ones
  (Swiss cantonal, US state, ...) are not removed from training. See
  `docs/03-methodology.md`.
- **Weekend labels involve judgement.** "Sunday only" for India, Mexico, Hong Kong,
  Bolivia and Honduras follows the cited source, but many offices there also close on
  Saturday.
- **One-day weekends defeat the current model.** With 1 weekend day in 7, the random
  forest can collapse to "always weekday" (exactly 50% balanced accuracy at La Paz
  and three Nepal stations). Class weighting is planned.
- **No precision/recall yet.** Holiday detection is reported as rates; precision,
  recall and PR-AUC against the holiday calendar are the next stage.
- **Data ends in mid-2020.** Nothing here is live.

---

## Cross-country weekend signature

A sceptic could argue that any weekly pattern is just *a* pattern. To check that it is
specifically human, we applied the same processing, unchanged, to countries that rest
on different days. This section involves no machine learning — it is medians of the
published recordings.

For every station with at least 40 pre-lockdown days, we took the median 4–14 Hz RMS
per day in local time, then the median per day-of-week, normalised to that station's
busiest day. Scoring every adjacent two-day pair gives an inferred weekend.

**156 stations qualified.** 132 are quietest on Sunday. Five are quietest on Friday.

| Country | City | Days | Fri | Sat | Sun |
|---|---|---:|---:|---:|---:|
| State of Palestine | Salfit | 142 | **0.498** | 0.631 | **0.983** |
| Israel | Station Amatzia | 123 | **0.757** | 0.755 | **0.951** |
| Saudi Arabia | Jeddah | 124 | **0.887** | 0.919 | **0.966** |
| Pakistan | Nilore | 114 | 0.860 | 0.889 | 0.906 |
| Nepal | Myagdi | 137 | 0.770 | 0.546 | 0.838 |

Israel, Palestine and Saudi Arabia all observe a Friday–Saturday weekend, with Sunday a
full working day. The seismic profile reflects exactly that. Salfit is clearest:
activity falls to half on Friday and returns to 98% of peak by Sunday.

Median normalised Sunday activity: **0.966** for those three stations, **0.683** for the
other 153. Mann-Whitney U, one-sided: p = 0.0032.

![Weekend signature](../outputs/plots/weekend_signature.png)

### Limitations of this section

- **n = 3** for the Fri–Sat group. The direction and effect size are the claim; the
  p-value rests on three stations.
- **Nepal is a metric artifact.** Nepal's weekly holiday is Saturday alone. Because
  Friday happens to sit below Sunday at Myagdi, the adjacent-pair metric labels it
  Fri–Sat. The other two Nepal stations correctly return Saturday.
- **Pakistan is a genuine middle case.** The cited source lists a Monday–Friday
  workweek with many businesses open Saturday, and Friday shows a dip, plausibly the
  Friday prayer break.
- **Station count differs from the headline 158** because this analysis uses
  pre-lockdown days only and requires >=40 days per station. The 158 figure describes
  the full modelling dataset; 156 describes this analysis. They measure different
  things.
- **Date parsing matters here.** `Table S1` uses dd/mm/yyyy. Pandas' default parse
  reads "08/03/2020" as 3 August 2020, months after the recordings end, which
  silently disables the pre-lockdown trim for any date whose day and month are both
  <= 12. `weekend_signature.py` forces `dayfirst=True`. The result is unchanged either
  way — the same five Friday stations appear — but the day counts differ.

Reproduce with `python src/weekend_signature.py`.
