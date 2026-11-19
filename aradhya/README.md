# aradhya/ — slide graphs and checks (2026-11-19)

One graph per slide, all drawn by `make_graphs.py` from the project's own result tables
(real Lecocq et al. 2020 data; USGS catalogue for slide 06). Nothing simulated.

| Slide | Graph | Script behind the numbers | Headline |
|---|---|---|---|
| 01 · The core task | `01_core_task.png` | `src/train_stations.py` | weekday vs weekend 94.9%, exact day 47.3% (149 stations) |
| 02 · Shape or volume | `02_shape_vs_volume.png` | `src/shape_vs_level.py` | shape beats volume at 142 of 149 stations (exact day) |
| 03 · Mistakes do the finding | `03_mistakes_find_events.png` | `src/score_days.py`, `src/confusion_detector.py` | confusion finds holidays, PR-AUC 0.63 vs 0.33 (chance 0.04) |
| 04 · Holiday test | `04_holiday_test.png` | `src/holiday_holdout.py` | 76% of unseen holidays read as "weekend" vs 5% of working days |
| 05 · Across cities | `05_across_cities.png` | `src/transfer.py` | 77–88% into Europe/N. America, 62–74% into Middle East & Africa |
| 06 · Subtract the people | `06_subtract_people.png` | `src/noise_floor.py` | not supported: 998 vs 953, p = 0.053; without Puerto Rico 254 vs 275 |
| The loop | `07_the_loop.png` | `src/noise_floor.py --export BE.UCC` | Brussels: 62% of the spread removed |

## What was checked

- **Every script behind slides 01–06 was rerun** from scratch (4 min total). Station
  scores, shape vs volume, the confusion detector, the transfer matrix and the
  noise-floor results came back **byte-identical**. Four tables differed only in the
  14th–17th decimal place (floating-point noise, at most 7.6 × 10⁻¹⁴); no slide number
  changed, so the committed versions were kept.
- **All 214 tests pass** (`pytest -q`).
- Slide 06 was also checked for timing alignment, false-alarm calibration (placebo 0.64%
  vs 1% intended), catalogue completeness and out-of-fold scoring: see Result 19 in
  `docs/04-results.md`.

## Remake the graphs

```bash
py -3.12 aradhya/make_graphs.py
```

Takes ~3 seconds once the scripts above have written `outputs/`.
