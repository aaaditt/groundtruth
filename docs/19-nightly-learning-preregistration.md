# 19. Pre-registration: does the live model get better if it keeps learning every night?

**Written 2026-11-24, before any walk-forward code was written or run.** Sections 1–6 are
fixed. Anything decided after the first run is labelled **exploratory** in
`docs/04-results.md` (Result 21).

The frozen City Pulse scores for 1 Oct – 21 Nov 2026 are already public
(`site/data/pulse_days.csv`, Result 13). The walk-forward scores have never been computed.

## 1. Question

City Pulse (Result 13) scores each new day with models trained once, on 1 Oct 2025 – 30 Sep
2026, and never trained again. If instead the model **keeps learning** — every ordinary new
day is added to training *after* it has been scored — does it name the day more often?

## 2. The rule (predict, then learn)

For each live station and each new day *t* from **1 Oct 2026**:

1. Train on the station's training year (`outputs/tables/live_days.csv`, `period ==
   "baseline"`, exactly the days the frozen model uses) **plus every new day before *t***
   whose calendar label is ordinary (`baseline`: not a public holiday, not 21 Dec – 6 Jan).
2. Score day *t* with that model. Day *t* is never in its own training set.
3. Only then may day *t* join the training set for later days.

Everything else is identical to the frozen model, so the only difference is the extra days:
the same 25 features (24-hour shape + level, with `level` scaled against the training year's
normal days, as in `src/pulse.py`), the same `make_model()` random forest
(`class_weight="balanced"`, `random_state=0`), the same 7-class and weekday-vs-weekend models.
The walk-forward scores are recomputed from 1 Oct every night (no saved state), so a rerun
gives the same numbers.

## 3. Stations and days

The 7 live stations City Pulse scores (`config/stations.yaml`, `status: live`): Brussels, Los
Angeles, Melbourne, Dublin, Montreal, Sharjah, Puerto Williams (control).
**Evaluation days:** ordinary (`baseline`) new days, **1 Oct 2026 – 31 Dec 2026**, that both
models score. (21–31 Dec fall in the festive window and are excluded by that rule.)

## 4. Primary test

Pooled over the 7 stations, on the same days: is the exact weekday named correctly more often
by the walk-forward model than by the frozen one?
**Exact McNemar test (two-sided) on the paired right/wrong outcomes, α = 0.05.**
"Learning helped" = walk-forward right on significantly more days than frozen.

## 5. Secondary (reported, not tested for significance)

- Per station: exact-day accuracy and weekday-vs-weekend balanced accuracy, frozen vs
  walk-forward.
- **Montreal separately:** its training year misses Feb – May 2026 and a quarter of its new
  days were flagged in the first month (Result 13), so it is the station where recent days
  should help most.

## 6. What we expect, written before running

**No significant pooled gain.** Result 18 showed that going from 1,600 days to all (~2,000)
adds +0.4 points; ~60 extra days on top of ~330 is a small change in data. A gain at Montreal
alone would not be surprising. Whatever comes out is reported.

## 7. When it is graded

The test runs once, after MUSTANG has data to 31 Dec 2026 (about mid-January 2027). Until
then the dashboard shows the running numbers labelled **interim**: they are not the test.
