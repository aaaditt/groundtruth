# Pre-registration: does more data, or more training, name the weekday from one day?

Written 2026-11-07, **before** any of the runs below. Sections 1-4 are frozen once committed;
results go in section 5.

## Why

Result 17 Part A reads the exact weekday from one day at a median of 56.7% (33 stations, three
bands x 48 half-hours, gradient boosting). The team wants this to rise. Three ideas, each
tested on its own:

1. **More days per station.** Is accuracy still rising as a station's model gets more days?
2. **More stations at once.** One model trained on all 33 stations' days together (about 72,000
   days) instead of one station's ~1,800.
3. **More training rounds.** More boosting iterations, i.e. the model going over the data more.

## 1. Fixed for every run

- Data, labels, features and days exactly as Result 17 Part A, configuration **A3** (147
  features per day), from the cached day tables of `src/weekday_experiment.py`.
- Train only on `period == "baseline"`; scored on baseline days; exact weekday accuracy,
  median over stations, is the primary metric (pooled accuracy and Tue-Thu as secondary).
- Model: `HistGradientBoostingClassifier(class_weight="balanced", random_state=0)` unless the
  run changes one named setting.

## 2. The three runs (fixed)

**L: learning curve (more days per station).** Result 17's week folds. In each fold the
training set is a random subset of n baseline training days, n = 100, 200, 400, 800, 1600 and
all (seed 0; a station with fewer days than n uses all of them for that n). The test days do
not change. Reported: median exact accuracy at each n.
Decision: "more own-station data is still paying off" if the median at **all** is at least
**2 points** above the median at **800**. Otherwise "the curve has flattened".

**P: pooling stations.** Folds by calendar week across all stations (`week_id`, GroupKFold(5)),
so a week is test for every station at once and never seen in training by any.
- P0: one model per station on these folds (the fair comparison).
- P1: one model for all 33 stations, with the station as a categorical feature.
- P2: one model for all 33 stations, no station feature.
Decision: pooling "helps" if the better of P1 and P2 has a median at least **2 points** above P0
**and** is higher than P0 at 22 or more of 33 stations.

**R: more training rounds.** Result 17's week folds, per-station models, `max_iter` = 100 (the
default, Result 17), 300 and 1000, learning rate unchanged (0.1), no early stopping.
Decision: "more rounds help" if the best `max_iter` beats 100 by at least **2 points** at the
median and at 22 or more stations.

## 3. Rules

- Every configuration listed above is reported, whatever it shows.
- If a run helps, the best configuration may be used in Ask (the site) afterwards; that
  choice is made on the same data, so it is reported as slightly optimistic.
- Anything else (other models, tuning other settings, deep learning) is exploratory.

## 4. Command

`python src/more_data_experiment.py` writes `outputs/tables/more_data_L.csv`, `more_data_P.csv`
and `more_data_R.csv` (station x configuration: n, exact, tue_thu).

## 5. Results (added 2026-11-07, after the pre-registration commit `4e00506`)

Run: `python src/more_data_experiment.py`. Tables: `outputs/tables/more_data_L.csv`,
`more_data_P.csv`, `more_data_R.csv`. Check: L at n = all gives 56.7%, the same as Result 17's
A3-GB, so the setup matches.

**L: learning curve. Verdict (by the rule): "more own-station data is still paying off".**

| training days per station | 100 | 200 | 400 | 800 | 1600 | all (~1,800) |
|---|---:|---:|---:|---:|---:|---:|
| median exact | 37.9% | 43.6% | 47.9% | 53.3% | 56.3% | 56.7% |

All beats 800 by +3.3 points, which passes the pre-registered bar. But the curve is bending:
going from 1600 to all adds only +0.4 points. Each doubling adds less than the last (+5.7,
+4.3, +5.5, +3.0). If that continues, years more data would add a few points, not the 33
needed for 90%.

**P: pooling stations. Verdict: "pooling does not help enough"** (it hurts).

| | P0 one model per station | P1 pooled + station | P2 pooled, no station |
|---|---:|---:|---:|
| median exact | **55.9%** | 50.4% (-5.5) | 45.9% (-10.0) |
| better than P0 at | | 0 of 33 | 0 of 33 |

A model trained on 72,000 days from all cities is worse at every station than each city's
own model. Each place has its own daily rhythm (time zone, commute times, local noise), so
other cities' days add confusion, not knowledge.

**R: more boosting rounds. Verdict: "more rounds do not help enough".**

| max_iter | 100 (default) | 300 | 1000 |
|---|---:|---:|---:|
| median exact | 56.7% | 56.5% | 55.7% |
| pooled exact | 55.3% | 55.8% | 55.8% |

More rounds help the pooled number by half a point and slightly hurt the median: the model
has already learned what one day holds.

### What this shows

The single-day ceiling is set by the data, not by the amount of training: one day's shaking
looks almost the same on a Tuesday, Wednesday or Thursday. The way past it is more **context**
(Result 17 Part B: the week around the day, 96.1%), not more of the same. Ask keeps Result
17's A3-GB model for its one-day guess.
