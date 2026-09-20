# 4. Results

All numbers below come from real data, produced by the scripts in `src/`, and are
reproducible with `./run_all.sh`. Every score is out-of-sample (see
`docs/03-methodology.md`, Step 5).

Dataset after cleaning: **158 stations, 28,749 station-days**; 149 stations had the
≥70 normal days required to train a per-station model.

---

## Result 1 — A seismometer can tell weekdays from weekends

Per-station models, 5-fold cross-validation holding out whole weeks:

| Task | Median across 149 stations | Chance |
|---|---|---|
| Weekday vs weekend (balanced accuracy) | **93.3%** | 50% |
| Exact day of week (accuracy) | **46.5%** | 14.3% |

**60% of stations score ≥ 90%** on weekday vs weekend.

![Accuracy across stations](../outputs/plots/accuracy_by_station.png)

Best stations for weekday/weekend (all 100.0%): Rundu (Namibia), Paris (FR.CURIE),
Geneva (CH.SGEV), Montreal (CN.MNTQ), Zurich (CH.SZUZ), San José (TC.SJS1),
Bergen (NS.BER), Bern (CH.SBERN).

Best stations for exact day of week: Dombås 72.2%, Chapinero (Bogotá) 69.8%,
Geneva 69.2%, **Athens 69.0%**, **New York 66.4%**, Florence 66.1%.

### The showcase cities

| Station | City | Sensor type | Weekday vs weekend | Exact day |
|---|---|---|---|---|
| `AM.R7885` | New York | Raspberry Shake (citizen) | 99.4% | 66.4% |
| `HL.ATH` | Athens | Professional network | 99.4% | 69.0% |
| `BE.UCC` | Brussels | Professional (paper author's own station) | 99.4% | 47.9% |

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
| `NC.MLI` | Mammoth Lakes, USA (mountains) | 46.9% | 15.4% |
| `GT.LPAZ` | La Paz, Bolivia | 47.0% | 15.3% |
| `BX.KOOLE` | Kule, Botswana (Kalahari) | 48.8% | 16.1% |
| `C1.MG01` | Puerto Williams, Chile (remote) | 49.3% | 10.2% |

These sit at chance — as they must, if we are measuring human activity rather than
some artefact of the method. **This is the project's built-in sanity check.**

And the effect scales with how many people are around: median weekday/weekend accuracy
is **89%** for the least dense third of stations, **91%** for the middle third and
**96%** for the densest third (Spearman ρ = 0.36, p < 0.0001 against population
density from Table S1).

---

## Result 3 — One model for cities it has never seen

`src/train_global.py` pools all normal days and is cross-validated by **station**, so
every test day comes from a city that contributed nothing to training.

| Task | Global model, unseen cities | Per-city models | Chance |
|---|---|---|---|
| Weekday vs weekend | **79.0%** | 93.3% | 50% |
| Exact day of week | **29.7%** | 46.5% | 14.3% |

Interpretation: the weekly rhythm of human activity is **partly universal** — a model
trained on Europe and the Americas transfers to a city it has never met and still beats
chance decisively. But each city has its own signature, and a local model is far better.
Cultural differences matter here: the working week is Mon–Fri in most of this dataset,
but not everywhere, and "weekend" is defined by the calendar, not by the local norm.

---

## Result 4 — Disruption detection

Models trained **only on normal days**, then applied to holiday and lockdown days they
had never seen. Median across 149 stations:

| | Normal days | Christmas / New Year | COVID lockdown |
|---|---|---|---|
| Weekdays the model calls "weekend" | 3% | **36%** | 10% |
| Days flagged as anomalous | 5% *(fixed by design)* | **18%** | **23%** |

![Disruption detection](../outputs/plots/disruptions_global.png)

The 5% baseline is not a result — it is the threshold definition (95th percentile of
normal days). The result is that holidays and lockdowns run at 3.5–4.5× that rate.

![New York anomaly timeline](../outputs/plots/AM_R7885_timeline.png)

In the New York timeline, the Christmas/New Year window and the post-lockdown period
both sit visibly above the normal-day band.

### Holidays discovered without being told

The anomaly detector has no holiday calendar. Its highest-scoring non-lockdown days:

| City | Top anomalous normal-period days |
|---|---|
| New York | 1 Jan, 25 Dec, **Thanksgiving (Thu 28 Nov 2019)**, 24 Dec |
| Athens | 1 Jan, 25 Dec, **6 Jan (Epiphany)**, 26 Dec |
| Brussels | 1 Jan, 25 Dec, **1 Nov 2019 (All Saints' Day — Belgian public holiday)** |

Thanksgiving and All Saints' Day are the striking cases: they are not in our
21 Dec – 6 Jan holiday window, so the system had no way to know about them. It found
them purely because the city's vibration pattern that day did not look like a normal
Thursday or Friday.

### Live demo results (`src/predict.py`)

| Station, date | Actual | Model's guess | Flagged? |
|---|---|---|---|
| New York, 12 Feb 2020 | Wednesday | Tuesday (37%) — wrong but adjacent | No |
| New York, **28 Nov 2019** (Thanksgiving) | Thursday | **Sunday (68%)** | **Yes** |
| New York, **25 Dec 2019** | Wednesday | **Sunday (96%)** | **Yes** |
| Brussels, **1 Nov 2019** (All Saints') | Friday | **Sunday (42%)** | **Yes** |
| Athens, 1 Apr 2020 (lockdown) | Wednesday | Tuesday (52%) | **Yes** |

---

## An honest negative result

**Lockdown did not make every day look like a Sunday.** Only ~10% of lockdown weekdays
were classified as "weekend" (vs 36% of holiday weekdays), even though lockdown days
were flagged as anomalous more often than holidays (23% vs 18%).

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
- **Holiday window is crude.** A fixed 21 Dec – 6 Jan window is Northern-Hemisphere,
  Christian-calendar-centric, and wrong for many of the cities in the dataset.
  Using each country's real public-holiday calendar is the top item in
  `docs/08-roadmap.md`.
- **Anomalies are only spot-checked.** Thanksgiving and All Saints' Day were matched by
  hand. We have not computed precision/recall against an official holiday list.
- **Weekend ≠ Sat/Sun everywhere.** In countries with a Fri–Sat weekend the labels are
  simply wrong, which will depress scores for those stations.
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
- **Pakistan is a genuine middle case.** The official weekend is Sunday, but Friday
  shows a dip, plausibly the Friday prayer break.
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
