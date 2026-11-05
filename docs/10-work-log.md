# 10. Work log — recent-data extension

Running record of what we do after the original build (`docs/07-build-log.md`). Newest
entries at the bottom. Only things that actually happened are recorded here; plans are
marked as plans.

---

## Part A — What we are doing and why

**Goal.** The project currently uses seismic data from 31 Oct 2019 to May 2020. We want
**recent data** (2021 onward) to answer two questions:

1. **Does the model still work on new data?** Train on the old normal days, test on
   recent days it has never seen. (Roadmap item 5.)
2. **The UAE weekend experiment.** On 1 Jan 2022 the UAE moved its weekend from
   Friday-Saturday to Saturday-Sunday. If our method measures human activity, the
   quietest days at a UAE station should shift with it. This is a natural experiment
   with a known date. (`docs/08-roadmap.md`, last section.)

## Part B — Where the data comes from

| Source | What it is | Used for | Reachable from our machine? |
|---|---|---|---|
| **Lecocq et al. (2020)**, GitHub `ThomasLecocq/2020_Science_GlobalQuieting` | Pre-computed 15-minute RMS ground motion, 4-14 Hz band, 173 stations, Oct 2019 - May 2020. doi:10.1126/science.abd2438 | All results so far (committed in `data/external/`) | n/a (already in repo) |
| **EarthScope (formerly IRIS)** FDSN web services, `service.earthscope.org` | Professional seismic networks, raw waveforms | Recent data for professional stations, UAE station `II.UOSS` | Yes (HTTP 200). Old `service.iris.edu` redirects (301) here |
| **Raspberry Shake** FDSN, `data.raspberryshake.org` | Citizen-science seismometers in homes/offices | Recent data for citizen stations in cities | Yes (HTTP 200) |
| **USGS** earthquake catalogue, `earthquake.usgs.gov` | Earthquake list | Only for roadmap item 8 (not planned now) | Yes (HTTP 200) |
| **SeismoRMS** (Lecocq), GitHub `ThomasLecocq/SeismoRMS` | The authors' method for turning waveforms into 15-min RMS | Method we copy so new data matches old data | n/a (code reference) |

The earlier build sandbox was blocked (HTTP 403) from all of these. From this machine
they are reachable (checked 2026-11-03).

**How raw data becomes our data.** Raw waveforms are huge, so recent data is converted
the same way the authors did it: download waveform, remove instrument response, band-pass
4-14 Hz, take RMS in 15-minute windows. Output has the same CSV layout as the old data
(a UTC timestamp column plus a `4.0-14.0` column), so the existing pipeline can read it.

## Part C — How the ML model works (current, unchanged)

All of this already exists and is verified; we are **not** changing it.

- **Features (25 per day).** Convert timestamps to the station's local time, take the
  hourly median of the 4-14 Hz RMS, subtract the day's mean to get a 24-number "shape",
  plus 1 number for overall level. The shape stops the model learning sensor loudness.
- **Model.** Random forest (scikit-learn, `random_state=0`), built in `groundtruth/models.py`.
- **Task 1: day of week.** Predict weekday vs weekend, and the exact day (7 classes).
- **Task 2: anomaly detection.** Flag days whose features lie beyond the 95th percentile
  of that station's normal days (robust median/MAD statistics). No labels needed.
- **Honest evaluation.** Train only on `period == "baseline"` days. Cross-validation holds
  out whole weeks (`GroupKFold`) per station, and whole stations for the global model.
  Never tune on holiday or lockdown days.
- **Current results:** always in `docs/04-results.md`. (This section first quoted the
  pre-correction numbers 93.3% / 46.5% / 79.0%; see the stage 1 entry below for old vs
  new.)
- **How recent data will be used.** Recent days get their own label (`period == "recent"`)
  and are **test-only**. Model is trained on old baseline days and scored on recent days.
  A drop in accuracy would be reported honestly, not tuned away.

## Part D — Hard rules we keep

Real data only (no synthetic data anywhere); cite every source; update docs whenever a
number changes; keep the evaluation honest. Full list in `CLAUDE.md`.

---

## Log

### 2026-11-03 — Repo set up
- Cloned `https://github.com/aaaditt/groundtruth.git`, created `.venv`, installed
  `requirements.txt`. Python 3.11.9, scikit-learn 1.9.1, pandas 3.1.0.
- Ran `python src/predict.py --station AM.R7885 --date 2019-11-28`: guessed Sunday (68%),
  flagged unusual. Matches the README. Pipeline works.
- `.venv/` excluded locally via `.git/info/exclude` (not in `.gitignore`).

### 2026-11-03 — Plan agreed
- Plan: acquire recent data, check against old data, refresh stations, test on recent
  days, then the UAE experiment, then update docs. Decisions: do both goals; test all
  sources first.

### 2026-11-03 — Step 1: access check (done)
- EarthScope: 200 (IRIS address redirects 301). Raspberry Shake: 200. USGS: 200.
- `fdsnws.raspberryshakedata.com` did not respond; not needed.

### 2026-11-03 — Step 2: tooling (done)
- Installed `obspy` 1.5.1 in `.venv`. **Not yet added to `requirements.txt`**; will be
  added when `src/get_recent_data.py` exists and needs it.
- obspy's built-in `RASPISHAKE` shortcut failed service discovery even though the
  endpoints answer. Workaround: query the station service over plain HTTP (works), and
  configure the client with an explicit base URL when we write the download script.

### 2026-11-03 — Station availability findings (done, queried live)
- **`AM.R7885` (New York) stopped recording on 2021-06-21.** So it cannot give recent
  data. The flagship demo city can't be refreshed; recent-data test stations must be
  chosen from stations still online.
- **`BE.UCC` (Brussels)** and **`CN.MNTQ` (Montreal)** are still active on EarthScope
  (Brussels has a gap 2016-2018, resumes 2018-10-29).
- **`HL.ATH`, `FR.CURIE`, `CH.SGEV`, `NS.DOMB`** returned nothing from EarthScope. Likely
  held by other data centres (not yet checked). **Unresolved.**
- **UAE candidates:**
  - `II.UOSS` (University of Sharjah), EarthScope, running since 2009, still active. The
    only candidate that **spans the 1 Jan 2022 change**. Caveat: a university broadband
    station may sit somewhere quiet; whether it shows a human weekly rhythm is untested.
  - Raspberry Shake `AM.R1F39` (Dubai area, from 2023-10), `AM.R85A6` (Abu Dhabi, from
    2024-05), `AM.S994C` (Dubai area, from 2026-01). All start **after** the change, so
    they cannot show a before/after shift. They could still show the post-2022 weekend.
- Nothing has been downloaded yet and no recent-data numbers exist.

### 2026-11-03 — Data-source deep check (done, queried live)
- **MUSTANG noise-psd works** (`service.earthscope.org/mustang/noise-psd/1/query`):
  pre-computed hourly noise spectra, already available for `II.UOSS` on 2026-10-29.
  This is a much lighter alternative to downloading raw waveforms. Explained in
  `docs/11-data-guide.md`.
- **`II.UOSS` sensor history:** location `00` swapped sensors on 2022-02-02 (bad for a
  before/after test). Location `10` (STS-2.5, 40 Hz) runs **continuously since
  2020-02-13**, and MUSTANG returned data for it on 2021-12-15, 2022-01-15 and
  2022-02-15. **UAE experiment is feasible on `II.UOSS.10.BHZ`.**
- **Raspberry Shake from Python fails:** "certificate has expired". `curl` via the
  Windows store succeeds. Fix planned: use the OS trust store (`truststore`), not
  disabling verification.
- **EIDA routing:** `CH.SGEV` (Geneva) found, still open. `HL.ATH`, `FR.CURIE`,
  `NS.DOMB` returned nothing. Still unresolved.
- EarthScope `availability/extent` returned 404; not needed.
- DOIs checked to resolve: `10.7914/SN/II`, `10.7914/SN/AM`, `10.7914/SN/BE`,
  `10.1785/0220170191`.

### 2026-11-03 — Master plan adopted
- A separate AI chat holding the original project vision wrote a master brief. Saved
  verbatim as `docs/12-master-plan.md`. It has two goals: (1) deliver the five promises
  from proposal slide 3 (checked: they match `docs/09`, lines 75-80); (2) build
  "City Pulse", a public dashboard that updates daily.
- Aadit's answers: final evaluation in **2-4 weeks**; format **written report +
  presentation + live demo**; public GitHub Pages dashboard and GitHub Actions
  **approved**. Aadit stressed that the tool should be genuinely useful and
  open-source, not only something for marks.
- **Schedule adopted** (working sessions, working back from ~day 21):
  - Days 1-2: groundwork (weekend table, real public holidays, relabel, rerun).
  - Days 3-8: the five promises.
  - Days 9-11: extras and report; tag `v1.0-semester` (numbers frozen).
  - Days 12-17: City Pulse v0 (MUSTANG stations, daily job, Pages site). This is the
    live demo.
  - Days 18-19: UAE weekend experiment, pre-registered.
  - Days 20-21: buffer and writing.
- **Where we depart from the brief, and why:**
  1. The brief starts the tool only after the tag. Because a live demo is graded and
     Aadit wants a real tool, a slim v0 is built before the deadline. It still cannot
     change any frozen number.
  2. MUSTANG (Route A) comes first and waveforms (Route B) after the deadline: MUSTANG is
     light and verified working, while Raspberry Shake retention and latency are unverified.
  3. **Retracted** our earlier idea of testing the Lecocq-trained model on recent
     data. It mixes data sources, which the brief's rule 3 forbids, rightly.
  4. Small-n caveats: region transfer may need merged regions; the Friday-weekend test
     is n = 3.
  5. Live models need about 12 months of history per station, so each station needs a
     one-off MUSTANG backfill.
  6. GitHub turns off scheduled workflows on repos inactive for 60 days. The daily data
     commit keeps the repo active.

### 2026-11-03 — Reframed: a genuine project, not a semester project
Aadit: "don't think of this as a sem project, treat this as a genuine interesting
project". The day-by-day deadline schedule above is **replaced** by the plan below.
The rules do not change: real data only, honest evaluation, cite sources, never mix
data sources, report null results.

**What GroundTruth is for.** Seismology throws away the everyday shaking of cities as
"noise". GroundTruth turns that discarded signal into something useful and gives it
back openly:
1. **A tool:** City Pulse, a public dashboard that reads each city's daily rhythm from
   public seismometers, every day.
2. **Open data:** a daily, per-city "human activity rhythm" dataset (hourly index, day
   guess, anomaly flag, model version), published openly so others can use it.
3. **Science:** honest answers to real questions. Is the rhythm learnable? Is a day's
   shape more informative than its loudness? Can confusion detect disruption? Does it
   transfer between cities, and does it persist over years? Do natural experiments
   (UAE weekend change, Ramadan, daylight saving) show up?

**Stages, ordered by dependency (each ends at a quality gate, not a date):**
1. **Correct foundations.** Per-country, date-aware weekends (`config/weekends.csv`,
   cited); real public holidays (`holidays` package) removed from training; the festive
   window kept as its own label; rerun with old vs new numbers logged.
   *Gate:* the labels are verified against sources and the results are regenerated.
2. **Engineering base, early** (because this is long-lived). `groundtruth/` package,
   `config/stations.yaml`, CLI, pytest on real fixtures, CI.
   *Gate:* green CI, and the old results reproduce exactly.
3. **Data layer.** Route A (MUSTANG) and Route B (waveforms with SeismoRMS; Raspberry
   Shake via `truststore`), with cached and polite fetching. Validate Route B against
   Lecocq on `BE.UCC` (hourly correlation > 0.9), and Route A against B by day shape.
   Then discover a **large** roster of live urban stations worldwide, not just 8.
   *Gate:* both routes validated; the roster records sensor swaps.
4. **Science core.** The five questions, run per source, plus temporal generalisation
   (does the rhythm last across years?) and the pre-registered UAE weekend experiment.
   *Gate:* every result, null or not, written up with its method.
5. **City Pulse + open dataset.** Daily GitHub Actions job, public GitHub Pages
   dashboard, published per-city data files with model version and source.
   *Gate:* >= 8 stations update daily for 7 days without manual action, and every
   number can be traced.
6. **Research extensions.** Anomaly typing (strike vs holiday vs storm); a pooled
   temporal model; the learned noise floor to reveal small earthquakes. That last one
   gives cleaner data back to seismology, and is never framed as prediction.

**Versioning instead of "frozen at the semester".** Results are tied to git tags
(`v1.0`, `v1.1`, ...). Any number that changes gets the old and new values, and the
reason, logged here. Whenever a snapshot is needed for coursework, it is just a tag.

### 2026-11-03 — Stage 1 done: correct weekends and real public holidays

**What we changed, in plain words.** Two labels were wrong. (1) "Weekend" was
Saturday–Sunday everywhere, but some countries rest on other days. (2) The only
"holiday" was 21 Dec – 6 Jan, so days like Thanksgiving were treated as normal days
**and the model was trained on them**. Both now come from cited sources:
- `config/weekends.csv`: weekend days per country with a `valid_from` date. Source:
  Wikipedia *Workweek and weekend*, pinned to the 31 Dec 2019 revision (the middle of
  our data). Rule: **the weekend is the days outside the standard workweek in that
  source.**
- Public holidays from the `holidays` package (v0.108, pinned), national calendars.
- `config/country_fixes.csv`: Table S1's country codes had errors. Namibia's `NA`
  was read by pandas as "missing"; Botswana had the network code `BX`; Iceland had
  the 3-letter `ISL`.
- New code: `src/calendars.py`. Changed: `src/build_dataset.py` (labels),
  `src/features.py` (no longer sets weekends), `src/detect_disruptions.py` (groups days
  by the country's weekend; adds a `festive` period, pooled rates and per-holiday
  rates), `src/train_stations.py` (now prints the control-group and density check,
  which before was computed by hand).

**Where the source disagreed with the master brief.** Palestine is **Friday only**
(Labour Law No. 7 of 2000: Saturday–Thursday workweek), not Friday–Saturday. Iran
(Friday only) was missing from the brief. India, Hong Kong, Mexico, Bolivia and
Honduras have a Monday–Saturday workweek in the source, so they are **Sunday only**:
a judgement call, noted in the config.

**Found along the way:** Sharjah (our UAE station `II.UOSS`) has had a Friday–Sunday
weekend for local government since 2022, while the UAE federally moved to
Saturday–Sunday. The UAE experiment must account for this.

**Checks.** Same 158 stations and 28,749 days. The 24 shape features and `level_raw`
are byte-identical; only `level` changed (it is scaled using normal days, which changed).
Weekend labels changed on 558 station-days in 11 countries. Normal (training) days
17,379 → 17,027. Public-holiday station-days: 1,127.

**Old vs new numbers** (old = original labels):

| Result | Old | New |
|---|---|---|
| Weekday/weekend, median of 149 stations | 93.3% | **94.6%** |
| Stations ≥ 90% | 60% | **65%** |
| Exact day, median | 46.5% | **47.0%** |
| Exact day, best (Dombås) | 72.2% | **71.3%** |
| Global model on unseen cities (pooled) | 79.0% / 29.7% | **80.9% / 30.8%** |
| Density effect, Spearman ρ | 0.36 | **0.39** |
| Density thirds (least / middle / densest) | 89 / 91 / 96% | **92 / 93 / 98%** |
| New York (wk/we, exact) | 99.4 / 66.4% | **100.0 / 67.0%** |
| Athens | 99.4 / 69.0% | **98.4 / 70.4%** |
| Brussels | 99.4 / 47.9% | **100.0 / 47.0%** |
| Thanksgiving demo | Sunday 68% | **Sunday 61%** |
| "Holiday" days flagged (old = Christmas window) | 18% (median) | public holidays **46.2%**, festive 16.5% (pooled) |
| Lockdown days flagged | 23% (median) | **34.5%** pooled / 24% median |

**The key finding.** Fixing the weekend labels made the signal appear at the
Friday-weekend stations: Jeddah 52.7% → 85.2%, Amatzia 72.8% → 96.9%, Salfit
74.6% → 95.8%. And never having seen a holiday in training, the model calls
**70.5% of weekday public holidays "weekend"** (n=634), against 2.7% of ordinary
weekdays.

**A problem found, not yet fixed.** La Paz and three Nepal stations now score
exactly 50.0%. With a one-day weekend (1 day in 7), the random forest answers
"weekday" every time. That is class imbalance, not absence of signal. The fix
(class weighting) changes the model, so it belongs to the promise-1 work, done
openly with before/after numbers.

**Reporting choice.** For holidays we now report **pooled** rates with `n`, because
most stations have only 1–5 weekday holidays and their per-station medians swing
between 0% and 100%.

### 2026-11-03 — Stage 2 done: engineering base

**What and why.** The project now has to grow into a live tool, so the shared code
needed a proper home and a safety net before we add new data sources.

- **Package.** `src/features.py`, `src/calendars.py` and `src/common.py` moved into
  `groundtruth/` (`features`, `calendars`, `models`), installable via `pyproject.toml`.
  `src/` keeps only the experiment scripts. The cross-validation splitter
  (`GroupKFold(5)`, previously written out in four scripts) is now one function,
  `make_cv()`, so the tests check the exact splitter the experiments use.
- **`config/stations.yaml`.** Roster for recent data, with a strict loader
  (`groundtruth/stations.py`) that rejects bad time zones, ids and providers. Only
  verified facts: II.UOSS.10.BHZ `live`; BE.UCC, CN.MNTQ, CH.SGEV `unverified`;
  AM.R7885 `offline`.
- **Tests (26, ~7 s, real data only).** Fixture = 1,486 rows copied verbatim from the
  New York file (1–16 March 2020, includes the DST switch on 8 March), regenerated by
  `tests/make_fixtures.py`. Checks: UTC → local hour in winter and summer time; the
  23-hour DST day is kept; partial edge days are dropped; recomputed features equal the
  committed dataset to 1e-9; weekend rules incl. the UAE switch; Namibia's "NA";
  Scottish holidays; period precedence; no week (per-station) or station (global) is
  ever in both train and test; training days are baseline only.
- **CI.** `.github/workflows/tests.yml`: pytest, plus a job that rebuilds
  `daily_features.csv` from the raw data on clean Linux and compares it with the
  committed file (`tests/check_reproduction.py`). The first version demanded byte
  equality and **failed**: 6,706 of 28,749 lines differed. The cause was the last
  binary digit of the floating-point maths, which differs between the Windows and
  Linux maths libraries (largest difference 2.15e-13, same numpy/pandas versions). The
  check now requires every label and integer column to be identical and floats to
  match within 1e-9, and prints the largest difference. Green on Linux.
- **Small fixes.** `.dayofweek` → `.day_of_week` (pandas deprecation, same values);
  `scipy` and `pyyaml` added to `requirements.txt` (scipy was used but only arrived
  indirectly through scikit-learn).

**Reproduction check.** Full `run_all.sh` after the refactor: `git status` shows **no
change** in `data/` or `outputs/` — dataset, score tables, anomaly scores and every
plot are byte-identical. Headline numbers unchanged (94.6% / 47.0% / 71.3% / 80.9% /
ρ = 0.39).

**A known limitation, now guarded by a test.** `week` is the ISO week number without
the year. Safe for Oct 2019 – May 2020, wrong for multi-year data (week 10 of 2021 and
2022 would merge). Changing it now would change fold assignment and break exact
reproduction, so `test_data_spans_less_than_a_year` will fail as soon as multi-year
data arrives, forcing a deliberate fix in Stage 3.

### 2026-11-03 — Stage 3 done: recent data (Route A), validated

**What and why.** The tool needs fresh data. Before building anything on it, we
checked that MUSTANG's spectra see the same city rhythm as the published data.

- **Polite client** (`groundtruth/client.py`). Generic User-Agent
  `groundtruth/1.0 (+https://github.com/aaaditt/groundtruth)`, at most 1 request per
  second, gentle retries on 429/5xx, OS certificate store via `truststore`
  (verification never disabled).
- **MUSTANG reader** (`groundtruth/mustang.py`). Downloads one month per request and
  caches months older than 10 days in `data/cache/` (git-ignored, re-fetchable;
  ~40 MB per station for 7 months). Each spectrum becomes 4-14 Hz **displacement RMS
  in metres**: power ÷ (2πf)⁴, summed over 1/8-octave bins, square root. Then it goes
  through the same `daily_features()` as the Lecocq data. Glitch filtering moved into
  `clean_rms()` so both sources are filtered identically (golden test still passes).
- **Coverage survey** (`src/survey_mustang.py` → `outputs/tables/mustang_coverage.csv`).
  103 non-Raspberry-Shake stations from the dataset: MUSTANG has **48** on 2020-01-15
  and **32** on 2026-10-01. Brussels and Montreal: covered. **Latency:** latest data on
  2026-11-03 was 2026-11-01 (Sharjah), so about 2 days.
- **Validation** (`src/validate_route_a.py` → `outputs/tables/route_a_validation.csv`,
  `outputs/plots/route_a_*.png`). Same days, unit-free comparisons only, 5 cities +
  1 control:

  | Station | Day-specific shape r | Control | Daily level r | Weekend acc. Lecocq → MUSTANG |
  |---|---|---|---|---|
  | Brussels | 0.94 | 0.03 | 1.00 | 100.0% → 100.0% |
  | Montreal | 0.91 | 0.02 | 0.97 | 100.0% → 95.7% |
  | Los Angeles | 0.96 | 0.05 | 1.00 | 100.0% → 98.5% |
  | Dublin | 0.98 | 0.02 | 1.00 | 99.4% → 98.8% |
  | Melbourne | 0.91 | −0.00 | 0.99 | 95.6% → 97.2% |
  | Puerto Williams (control) | 0.92 | −0.00 | 0.99 | 50.1% → 49.6% |

  The control station's noise is tracked just as well, but neither source finds a
  weekly rhythm there. MUSTANG doesn't invent rhythm.

**A correction we made along the way (timestamps).** We first labelled each one-hour
spectrum by its middle. The plots showed MUSTANG's weekday curve rising about half an
hour *later* than Lecocq's. We tested three conventions on the 6 stations above:
middle, MUSTANG's own start label, and "only the spectrum covering exactly that clock
hour". The start label agreed best **at all 6 stations, including the control**
(day-specific r, middle → start: Brussels 0.77 → 0.94, Montreal 0.68 → 0.91, Melbourne
0.72 → 0.91). We now use MUSTANG's timestamp unchanged. Lecocq's timestamps
(`hh:14:59`, `hh:29:59`, ...) suggest their windows start at the stamp, but their
processing code is not in the vendored repository, so that remains a likely
explanation, not a verified one. This choice was made on the same 6 stations it is
reported on: treat the table as a validation of agreement, not an independent test.

**Other findings.**
- **Year-aware weeks.** New `week_id()` (e.g. 202209) for multi-year data. The published
  pipeline keeps the old `week`; a test proves both group the Lecocq days identically,
  so nothing changes there.
- **Time-zone fix (live roster only).** Table S1 gives Puerto Williams (Chile)
  `America/Argentina/Buenos_Aires`. The roster uses `America/Punta_Arenas`. Both are
  UTC−3 all year on every date checked, so published results are unaffected.
- **Raspberry Shake certificates.** The "certificate has expired" error from earlier
  no longer reproduces: plain `requests` now connects too. `truststore` stays as a
  safeguard. Station metadata confirms AM.R1F39 recorded in France (2021) and has
  been in Dubai since 2023-10-09.
- **Station roster.** `config/stations.yaml` now has 7 live MUSTANG stations (the 6
  validated + Sharjah), Geneva (EIDA, unverified) and New York (offline).
- **Network DOIs** (BE, CN, CI, EI, S1, C1, II) checked against the FDSN registry and
  added to `docs/02`.
- Tests: 32, all real data (new: a verbatim MUSTANG response from Sharjah, with the
  unit conversion recomputed by hand).

### 2026-11-04 — UAE experiment pre-registered (no data downloaded)

The hypothesis, data, test and decision rules are fixed in
[`docs/14-uae-preregistration.md`](14-uae-preregistration.md), committed on its own
before any Sharjah data is fetched.
- **Hypothesis, in one line:** from 1 Jan 2022 Sunday became a rest day in Sharjah, so
  Sunday's ground vibration should fall relative to Mon–Thu.
- **How it is checked:** an exact week-level permutation test, one-sided, α = 0.05.
- **Controls:** a gatekeeper check (is there a weekly rhythm at all?), Saturday as a
  placebo day, and the same analysis one year earlier as a placebo year.
- **Changes from the earlier plan:** the window is wider than the Dec 2021 – Feb 2022
  first planned, Oct 2021 – Mar 2022, so there are enough "before" weeks. Sharjah's own
  Fri–Sat–Sun weekend (Gulf News, 9 Dec 2021) is taken into account. The school winter
  break is excluded.

### 2026-11-04 — UAE experiment run: the ground noticed the new weekend

Run after the pre-registration commit (`76d526f`), exactly as specified. Full write-up in
`docs/14`, section 7.
- **Verdict: SUPPORTED.** Sunday fell 20% relative to Mon–Thu after 1 Jan 2022 (exact
  permutation p = 0.003).
- **Controls behaved.** In the placebo year Sunday moved +5% (p = 0.73), and Saturday
  barely moved (−3%).
- **Surprise:** Friday got 53% busier (p = 3 × 10⁻⁶). The pre-registration expected
  little change there, and says so; we report it as wrong.
- **Exploratory:** the whole Friday rose, not only the morning.
- **Caught before writing it up:** a dip at 13:00 matches the new 13:15 prayer time
  elsewhere in the UAE. But Sharjah kept its old prayer time, so we don't claim that
  link.

### 2026-11-04 — Stage 4: the five promises

All on the Lecocq data, all rerun from scratch. Full tables in `docs/04` (Results 5–9).

**1. Class weighting (`class_weight="balanced"`), before → after**

| Measure | Before | After |
|---|---|---|
| Weekday vs weekend, median | 94.6% | 94.9% |
| Exact day, median | 47.0% | 47.3% |
| Global model, unseen cities | 80.9% | 83.0% |
| Held-out holidays called "weekend" | 70.5% | 75.6% |
| Ordinary weekdays called "weekend" | 2.7% | **5.6%** |

- 59 stations improved by more than 1 pp and 17 got worse.
- **The big surprise:** it did *not* rescue La Paz or Nepal (still about 50%). So their
  problem was never imbalance; there is just no detectable weekend there. The docs said
  otherwise and are corrected.
- **Biggest gains:** Ocotepeque 70 → 95%, Tegucigalpa (CU) 76 → 92%.

**2. Shape vs loudness**

- **Shape adds a lot:** +5.5 pp for weekday/weekend, +17 pp for the exact day
  (p ~ 10⁻¹⁹ and 10⁻²⁵). Logistic regression agrees.
- **The shape + loudness split does not itself help.** Raw hourly values do 0.5–1.7 pp
  *better* with the forest. We keep the split because it is the only form that is
  comparable across stations, and we say so.

**3. Confusion detector**

- Confusion = 1 − P(true day). Median PR-AUC for public holidays is 0.63, against 0.33
  for the anomaly score (chance 0.04). Confusion is higher at 110 of 147 stations.
- The anomaly score is better for lockdown: 28% vs 21% of days flagged.
- **Top-20 days per showcase city:**
  - Each city's top 5: every explained day is a holiday or Christmas-season day.
  - Two more are explained with sources: the day after Thanksgiving in New York, and the
    day after Belgium's first COVID measures.
  - 36 are unexplained, and are mostly what chance predicts at that threshold.

**4. Holiday hold-out**

- 75.6% of held-out weekday holidays are called "weekend", vs 5.5% of ordinary weekdays.
- By type:

  | Type | Called "weekend" |
  |---|---|
  | New Year | 90% |
  | Christmas/Easter | 85% |
  | Other religious | 67% |
  | Civic | 57% |
  | Bridge days | 49% |

**5. Transfer**

- Which region you *test* on matters more than which one you train on. Middle East &
  Africa is hardest (62–74%).
- **Weekend-shift test:** a Saturday–Sunday-only model calls Salfit's and Amatzia's
  Fridays "weekend" (100% and 87%) and their Sundays working days.
- **Jeddah** is called weekend every day. Its daily shape is unlike any training city;
  the cause is unknown.
- **What goes with poor transfer:** a weak own rhythm (ρ 0.76), low density (0.27) and
  low latitude (0.25). Sensor type and data gaps don't matter.

**Bugs caught along the way**

- A stray command made the first class-weighting run wait on input for over 20 minutes
  without doing anything.
- `load()` read Namibia's code "NA" as missing, the Stage 1 bug again through a
  different door. It is fixed in `load()`; two scripts now read through it.
- `"holi"` (the festival) matched "Substitute **Holi**day". The keyword rules now use
  word boundaries.
- The old anomaly score took its normal-day statistics from days that included the day
  being scored. The new `groundtruth/detect.py` is fully out-of-fold, and a test proves
  why that matters.

Tests: 46, all real data.

### 2026-11-04 — Live models: each city, trained on the last 12 months

**What.** `groundtruth/live.py` + `src/train_live.py`. For the 7 live MUSTANG stations,
download 1 Oct 2025 – 30 Sep 2026, build the usual 25 features, label days with the
Stage 1 rules, score with whole weeks held out, then fit final models (saved to
`outputs/models/live/`, not committed). Full table: `docs/04`, Result 11.

**Why a fixed window.** MUSTANG keeps adding late data for ~10 days after a month ends,
so October 2026 wasn't final. A fixed window also means the numbers reproduce.

**Results (weekday vs weekend / exact day).** Brussels 100% / 54.8%, Los Angeles
99.3 / 62.9, Melbourne 98.9 / **74.9** (best of any station we have), Dublin 98.6 / 58.1,
Montreal 97.6 / 58.4, Sharjah 71.6 / 41.3, Puerto Williams (control) 64.9 / 25.0.

**Surprises.**
- The control town is above chance now (64.9%; beats all 200 week-shuffled
  permutations, p = 0.005). It was 56.4% in 2019–20. Reported, not explained.
- Montreal has almost no data Feb–May 2026; Puerto Williams none in Nov–Dec 2025.

**Housekeeping.**
- The MUSTANG cache is now gzip-compressed: 284 MB → 54 MB, ~0.9 MB per
  station-month. Old `.txt` files still load (`mustang.compress_cache()` converts them).
- The first run was stopped by Windows running low on memory (other apps, not the
  script); a rerun from the cache reproduced the first 4 stations exactly.
- A test caught that saving `live_days.csv` rounded to 6 digits moved one Dublin
  forest split (exact day 58.4% vs 58.1%). The file is now saved at full precision.
- The README intro still said "70% of holidays / 3% of weekdays" (before class
  weighting). Fixed to 76% / 6%.

Tests: 52 (6 new), all pass.

### 2026-11-04 — Stage 5: City Pulse dashboard

**What.** A public web page, https://aaaditt.github.io/groundtruth/, updated every day
by a GitHub Action (`.github/workflows/pulse.yml`, 06:00 UTC):
1. `src/pulse.py` downloads MUSTANG from 1 Oct 2026 to today for each live station.
2. `groundtruth/pulse.py` scores each new day with `detect.score_station` — the same
   honest scorer as Result 8. Models are rebuilt from the committed `live_days.csv`
   each run (seconds, identical forests thanks to `random_state=0`), so no model
   files are committed.
3. Results go to `site/data/pulse.json` and `site/data/pulse_days.csv` (the open
   dataset), are committed, and `site/` is published to GitHub Pages.

**What a card shows.** Which weekday yesterday looked like (7 probabilities, true day
marked); a badge "Normal rhythm" / "Unusual day"; the unusualness score over time
with the 95% line and public holidays marked; the **live track record** on new normal
days next to the training score; a table view. Offline stations say "no data", never
a guess.

**First month, all days never seen in training (run of 2026-11-04).**
- Dublin's **October Bank Holiday (Mon 26 Oct)** was called *Sunday*, P(weekend) 1.00,
  flagged by both detectors.
- Puerto Williams' 12 Oct holiday was called Sunday and flagged.
- Weekday vs weekend on new normal days: 100% in Brussels, LA, Dublin, Melbourne.
- **Montreal is drifting:** 25% of days flagged anomalous (5% expected), weekday vs
  weekend 80%. Its training year misses Feb–May. And 12 Oct (Canadian Thanksgiving) is
  not marked as a holiday: the national `holidays` calendar for Canada leaves it out.

**Found along the way.** The station service puts II.UOSS ("Univ. of Sharjah") at
24.9453° N, 56.2042° E, ~90 km east of Sharjah city. Added to `docs/14` §7 and
`docs/04` Result 10 as a limit. The Sunday result stands; how Friday is read depends on
which emirate's rules apply there, which we have not verified.

**Other.** Station coordinates added to `config/stations.yaml` (checked by the
loader). Leaflet is pinned with integrity hashes computed from the files. All
dashboard text is built with `textContent`, never by pasting data into HTML.

Tests: 57 (5 new), all pass.

### 2026-11-04 — Extras: band test, research map, game, predictions, final report

**Band test** (`src/band_test.py`, `docs/04` Result 12). Five frequency bands on the 7
live stations, from the MUSTANG cache (no new downloads). Median weekday vs weekend:
0.1–1 Hz **51.4%** (ocean waves: the natural control works), 1–4 Hz 98.4%, **4–14 Hz
98.6%**, 14–19.7 Hz 95.3%, 1–19.7 Hz 95.3%. Dublin loses its rhythm below 4 Hz (50.0%)
and across the wide band (47.9%).

**Predictions board.** 18 predictions in `config/predictions.csv`, committed in
`6294930` before their dates (P01, Melbourne Cup Day, was registered the day after but
before its data arrived; the file says so). `src/pulse.py` grades them daily.

**Website.** `game.html` (guess the weekday from a real day's shape; the model's
answers are its out-of-fold guesses, checked by a test), `research.html` (all 158
stations coloured by accuracy, band chart), predictions board on the dashboard, shared
`common.js`. Checked in a browser at desktop and phone widths; fixed clipped labels,
overlapping end labels, and the legend covering data in `band_test.png`.

**Final report.** `docs/13-final-report.md`. Every number copied from `docs/04`;
reference details checked against `docs/02`.

Tests: 59, all pass.

### 2026-11-04 — History pilot: check written down before downloading

Idea: a globe on the site with a date slider over the last few years. First, a pilot
(`src/history_pilot.py`): download MUSTANG for the 7 live stations, Jan 2019 – Sep
2026, and check it against the best-known event in the data, the 2020 lockdowns.

**The check, fixed before any data was downloaded:**
- *before* = ordinary working days from 7 Jan 2020 to the day before the city's
  lockdown (Table S1); *during* = working days in the 4 weeks from the lockdown date.
- change = 10^(median level during − median level before) − 1, a % change in vibration
  amplitude with no units, computed in each source separately on the same dates.
- PASS per city: both sources agree on the sign and are within 10 percentage points.
  Six cities, so this is a sanity check, not a statistical test.

If it fails, the globe would be built on data we can't trust, and we stop there.

**Result: 6/6 pass, every city within 0.7 points** (`docs/04` Result 14). Download took
about 75 minutes; cache now 501 MB. Surprises: Sharjah's level jumps 1.5×+ for months
(probably the site, not the city), and Puerto Williams is missing most of Jul 2020 –
Oct 2021. So the globe must compare each day with recent weeks, not a fixed year.

### 2026-11-04 — The time-travel globe (33 cities, 2019–2026)

**Decided before downloading:** stations = every published-study station MUSTANG served
in 2020 and 2026 (no picking by results) + Sharjah; colour = level vs the same weekday
over the previous 8 weeks, ordinary days only (`groundtruth/history.py`).

**Done:**
- Downloaded 26 more stations (3 workers, each 1 request/second; ~2 hours; cache 2.2 GB).
- **Found two misplaced stations in Table S1** while checking coordinates against the
  FDSN station service: Nilore (in Paraguay instead of Pakistan) and Davao (in Malaysia
  instead of the Philippines). Fixed on the globe and the research map. Density result
  unchanged (ρ 0.389 → 0.385 without them).
- Made the MUSTANG parser 8× faster (one `read_csv` instead of one per spectrum),
  checked bit-identical on 44 real months and in a test.
- `site/globe.html`: MapLibre 3D globe (OpenFreeMap tiles, no key), date slider and
  play, jump buttons, fly-to, per-city year calendar, shareable links
  (`globe.html#2020-03-23/BE.UCC..HHZ`). Checked in a browser at desktop and phone width,
  light and dark. Fixed: a colour expression MapLibre rejected, a "Loudest" list that
  showed quieter cities, an over-long holiday line.
- Result 15: weekday holidays −19.4% vs ordinary weekdays 0.0%; 5 → 12 → 17 of 24
  cities quiet on the three Mondays from 16 Mar 2020. Cojutepeque's holidays are louder,
  unexplained.

Tests: 66, all pass.

### 2026-11-05 — New front door, and the site moves to Vercel

**Done:**
- `site/index.html` is now a scrolling tour (one day under Brussels, March 2020 city by
  city, a weekday/weekend quiz against the model). Every number in it is computed in the
  browser from the existing `site/data/` files; nothing new was generated. The old
  dashboard is now `site/today.html`. One shared menu and one look on every page.
- Hosting moved to Vercel (https://groundtruth-seismic.vercel.app/): plain static files
  from `site/`, no build step (`vercel.json`), Git integration so every push to `main`
  (including the daily data commit) redeploys. Files are sent with
  `Cache-Control: max-age=0, must-revalidate`, so a new day's data shows up at once.
  GitHub Pages stays up as a mirror until a daily bot commit is seen deploying.
- Checked in a real browser on Vercel: 7 views × desktop/phone × light/dark, no console
  errors.

Tests: 83, all pass.

## Next steps
Watch the dashboard for 7 days of unattended updates and the first graded predictions
(Melbourne Cup Day, 11 Nov). Thanksgiving (26 Nov) is the headline live test.
Later: regional holiday calendars (Quebec, Victoria); automatic retraining with a
fixed rule; more stations (EIDA / Raspberry Shake, Route B).
