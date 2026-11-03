# groundtruth

### Can a seismometer tell what day of the week it is?

Traffic, trains, footsteps and machinery shake the ground by a few tens of nanometres.
Seismometers record that shaking continuously, everywhere, for free. This project uses
**real recordings from 158 seismometers worldwide** to train machine-learning models
that (1) read the **day of the week** off one day of ground vibration, and (2) flag days
that **break a city's normal rhythm** — holidays, lockdowns, disruptions.

It works. A random forest tells weekdays from weekends with **95% median accuracy**
across 149 cities, names the exact weekday **3× better than chance**, and — never
having seen a holiday in training — calls **70% of weekday public holidays a
"weekend"** (vs 3% of ordinary weekdays), including Thanksgiving in New York and
All Saints' Day in Brussels.

> Course project for Foundations of Data Science, BITS Pilani · presented 22 Sep 2026
> Team: Aadit Chandra, Aradhya Gupta, Shraddha Pradeep
> Registered title: *Learning Urban Activity Rhythms from Ambient Seismic Noise for
> Anomaly-Based Disruption Detection*

**Everything here uses real, published data. There is no synthetic data in this project.**

---

## The evidence, in one picture

![New York weekly rhythm](outputs/plots/AM_R7885_weekly_rhythm.png)

One Raspberry Shake seismometer in New York, 113 normal days. Weekdays (cool colours)
share a sharp commute-shaped curve. Saturday (red) sits below it. Sunday (orange) is
lowest and starts latest. The weekly rhythm of a city, measured through the ground.

---

## Start here

**If you have 2 minutes** → read this page, then look at
[`docs/04-results.md`](docs/04-results.md).

**If you're new to machine learning** → [`docs/05-ml-primer.md`](docs/05-ml-primer.md)
explains every concept used here, with this project as the running example. No prior
knowledge assumed.

**If you want to run it** → [Quick start](#quick-start) below. About 15 minutes.

**If you're preparing the presentation** →
[`docs/06-presentation-guide.md`](docs/06-presentation-guide.md) has a slide-by-slide
plan, speaker notes and the questions to expect.

**If you're an AI coding agent picking this up** → read
[`CLAUDE.md`](CLAUDE.md) first. It has the rules, the state of the project and the
gotchas already solved.

---

## Documentation map

| Document | What's in it |
|---|---|
| [`docs/01-concept.md`](docs/01-concept.md) | The idea, the physics, why this is a good project, what we claim and don't |
| [`docs/02-data-and-sources.md`](docs/02-data-and-sources.md) | Exact dataset provenance, the three papers, how to download the data |
| [`docs/03-methodology.md`](docs/03-methodology.md) | Features, models, and every safeguard against cheating |
| [`docs/04-results.md`](docs/04-results.md) | All results with plots, the control group, limitations |
| [`docs/05-ml-primer.md`](docs/05-ml-primer.md) | Machine learning from scratch, explained through this project |
| [`docs/06-presentation-guide.md`](docs/06-presentation-guide.md) | Slide order, talking points, expected questions |
| [`docs/07-build-log.md`](docs/07-build-log.md) | Honest record of how this was built, including the wrong turn and every bug |
| [`docs/08-roadmap.md`](docs/08-roadmap.md) | What to do next, ordered by value for effort — including subtracting the learned human-noise floor to make small earthquakes detectable in cities (future work, not implemented) |
| [`docs/09-presentation-script.md`](docs/09-presentation-script.md) | Proposal presentation script — 3 slides, 3 speakers, Q&A. Deliberately contains no classifier results |
| [`docs/10-work-log.md`](docs/10-work-log.md) | Running log of the recent-data extension (post-presentation work) |
| [`docs/11-data-guide.md`](docs/11-data-guide.md) | Where live seismic data lives (FDSN, EarthScope, MUSTANG, Raspberry Shake, EIDA), how fresh it is, how we plan to use it |
| [`docs/12-master-plan.md`](docs/12-master-plan.md) | Master brief: semester deliverables (the five promises) and the City Pulse tool, phase by phase |

---

## Headline results

All scores are out-of-sample, with **whole weeks held out** (see
[methodology](docs/03-methodology.md)).

| Result | Number | Chance |
|---|---|---|
| Weekday vs weekend, median over 149 stations | **94.6%** balanced accuracy | 50% |
| Exact day of week, median | **47.0%** | 14.3% |
| Exact day of week, best station (Dombås, Norway) | **71.3%** | 14.3% |
| One global model, tested only on **cities it never saw** | **80.9%** | 50% |
| Weekday public holidays the model calls "weekend" (never trained on any) | **70.5%** (n=634) | vs 2.7% of normal weekdays |
| Public-holiday days flagged as anomalous | **46.2%** | 5% by design |
| Lockdown days flagged as anomalous | **34.5%** | 5% by design |

Showcase cities: New York `AM.R7885` (100.0% / 67.0%), Athens `HL.ATH` (98.4% / 70.4%),
Brussels `BE.UCC` (100.0% / 47.0%).

**The control group:** seismometers in Mammoth Lakes, the Kalahari and Puerto Williams
score at chance — no people, no signal — and accuracy rises with population density
(Spearman ρ = 0.39, p < 10⁻⁶). And when weekends are labelled correctly per country,
the Friday-weekend stations jump (Jeddah 53% → 85%, Amatzia 73% → 97%, Salfit
75% → 96%). That's the strongest evidence we're measuring humans.

*Weekends follow each country's own calendar, and official public holidays are
excluded from training (labels corrected 2026-11-03; see `docs/03-methodology.md`).*

---

## Quick start

```bash
git clone https://github.com/aaaditt/groundtruth.git
cd groundtruth
pip install -r requirements.txt

./run_all.sh          # reproduces everything (~15 min); the data is already in the repo

pip install -r requirements-dev.txt
pytest -q             # ~10 s: local time, DST, weekend rules, CV leak checks, all on real data
```

GitHub Actions runs the tests on every push, and also **rebuilds the dataset from the
raw recordings on a clean Linux machine and checks it matches the committed file**:
every label identical, every number within 1e-9 (`.github/workflows/tests.yml`).

`run_all.sh` is just these steps in order — run them individually if you prefer
(on Windows, use Git Bash or run the Python lines one at a time):

```bash
python src/get_data.py                              # no-op: the dataset is committed under data/external/
python src/build_dataset.py                          # -> data/processed/daily_features.csv
python src/train_stations.py                         # per-city models (~5-8 min)
python src/train_global.py                            # one model, tested on unseen cities
python src/showcase_city.py --station AM.R7885       # slide plots for one city
python src/detect_disruptions.py --station AM.R7885  # holiday / lockdown anomaly detection
```

**Both datasets are committed.** The raw recordings are vendored under
`data/external/` (see [`data/external/PROVENANCE.md`](data/external/PROVENANCE.md)), so
there is no download step — clone the repo and everything runs. The processed table
(`data/processed/daily_features.csv`, 158 stations × ~180 days) is committed too, so you
can skip straight to training if you just want to play with the models.

This makes the clone large (~113 MB). The trade was deliberate: the exact bytes every
result was computed from are pinned in history rather than fetched from an upstream
repository that could move.

### The live demo

```bash
python src/predict.py --station AM.R7885 --date 2019-11-28   # Thanksgiving -> "Sunday" (61%)
python src/predict.py --station AM.R7885 --date 2019-12-25   # Christmas    -> "Sunday" (97%)
python src/predict.py --station AM.R7885 --date 2020-02-12   # ordinary Wednesday
python src/predict.py --station BE.UCC   --date 2019-11-01   # All Saints' Day, Brussels
```

The model is retrained without the week containing the date you ask about, so every
answer is a genuine blind guess.

Other good stations: `HL.ATH` (Athens), `BE.UCC` (Brussels), `FR.CURIE` (Paris),
`CN.MNTQ` (Montreal), `CH.SGEV` (Geneva), `NS.DOMB` (Dombås). Full list with scores in
[`outputs/station_scores.csv`](outputs/station_scores.csv).

---

## How it works, in six lines

1. Take the 4–14 Hz band — the frequencies where human activity lives.
2. Convert every timestamp to the station's **local** time (rush hour isn't 8 a.m. UTC).
3. Reduce each day to 24 hourly medians → the day's **shape** (24 numbers) plus its
   overall **level** (1 number).
4. Train a random forest on **normal days only**, holding out whole weeks for testing.
5. Predict: weekday vs weekend, and exact day of week.
6. Flag any day whose 25 features sit beyond the 95th percentile of that station's
   normal days → **disruption detection**, with no labels required.

Full detail in [`docs/03-methodology.md`](docs/03-methodology.md).

---

## Repository layout

```
groundtruth/
├── README.md                    you are here
├── CLAUDE.md                    instructions for AI coding agents working on this repo
├── requirements.txt
├── run_all.sh                    reproduce everything
│
├── docs/
│   ├── 01-concept.md             the idea and the physics
│   ├── 02-data-and-sources.md    dataset provenance + papers
│   ├── 03-methodology.md         features, models, honest evaluation
│   ├── 04-results.md             all results, plots, limitations
│   ├── 05-ml-primer.md           ML explained for beginners
│   ├── 06-presentation-guide.md  slides, talking points, Q&A
│   ├── 07-build-log.md           how this was built, mistakes included
│   ├── 08-roadmap.md             next steps
│   └── 09-presentation-script.md proposal talk script (no classifier results)
│
├── groundtruth/                 the reusable package (import groundtruth)
│   ├── features.py               15-min RMS -> 24-hour daily features (local time)
│   ├── calendars.py              weekends + public holidays per country (cited)
│   ├── models.py                 the model, the CV splitter, dataset loading
│   ├── stations.py               loads + checks config/stations.yaml
│   ├── client.py                 polite HTTP client (rate limit, retries, OS certificates)
│   └── mustang.py                recent data: MUSTANG spectra -> 4-14 Hz displacement RMS
│
├── config/
│   ├── weekends.csv              weekend days per country, with source + start date
│   ├── country_fixes.csv         corrections to Table S1 country codes
│   └── stations.yaml             station roster for recent/live data (Stage 3)
│
├── tests/                        pytest on REAL data excerpts (no synthetic data)
│   ├── make_fixtures.py          cuts the excerpts from data/external, verbatim
│   └── fixtures/                 two weeks of New York incl. the DST switch
│
├── src/                          experiment scripts: every reported number comes from here
│   ├── get_data.py               download the Lecocq et al. 2020 dataset
│   ├── build_dataset.py          all stations + metadata + period labels
│   ├── train_stations.py         per-city models, week-held-out cross-validation
│   ├── train_global.py           one model, tested on unseen cities
│   ├── showcase_city.py          presentation plots for one city
│   ├── detect_disruptions.py     holiday / lockdown anomaly detection
│   ├── predict.py                live demo: one station, one date, one guess
│   ├── survey_mustang.py         which stations have recent data (needs internet)
│   ├── validate_route_a.py       recent-data route vs the published data (needs internet)
│   ├── weekend_signature.py      cross-country weekend analysis (no ML)
│   └── make_presentation_plots.py  the four proposal figures (no ML)
│
├── data/
│   ├── external/                 raw source dataset, committed (~333 MB; see PROVENANCE.md)
│   └── processed/
│       └── daily_features.csv    158 stations x ~180 days, 25 features each (committed)
│
└── outputs/
    ├── plots/                    all figures (presentation-ready)
    ├── tables/
    │   └── weekly_profiles.csv   per-station weekly profile, quietest day, inferred weekend
    ├── station_scores.csv        per-station accuracy for every station
    ├── global_model_unseen_city_scores.csv
    ├── disruption_summary.csv    holiday/lockdown detection rates per station
    └── daily_anomaly_scores.csv  every station-day with its anomaly score
```

---

## Data and citation

The seismic data is **not ours**. It comes from the official companion repository of:

> **Lecocq, T., Hicks, S. P., Van Noten, K., et al. (2020).** Global quieting of
> high-frequency seismic noise due to COVID-19 pandemic lockdown measures. *Science*,
> 369(6509), 1338–1343. doi:[10.1126/science.abd2438](https://doi.org/10.1126/science.abd2438)
> — https://github.com/ThomasLecocq/2020_Science_GlobalQuieting

Supporting literature: Díaz et al. (2017), *Scientific Reports* 7:15296; Groos & Ritter
(2009), *GJI* 179(2):1213. Full details and links in
[`docs/02-data-and-sources.md`](docs/02-data-and-sources.md).

If you use this repository, please cite Lecocq et al. (2020) for the data.

---

## Honest notes

- The published results use data ending in **May 2020**. A route to recent data
  (EarthScope's MUSTANG spectra, about 2 days behind real time) is built and
  **validated against the published data on 6 stations** (`docs/11-data-guide.md`),
  but no live model or dashboard exists yet.
- Public holidays are **national** calendars only; regional holidays are not excluded.
- Weekend labels follow a cited source per country, but involve judgement for
  Monday–Saturday countries (India, Mexico, ...). One-day weekends make the current
  model collapse to "always weekday" at a few stations (see `docs/04-results.md`).
- Precision/recall of the anomaly flags against holiday calendars is not computed yet.
- Two of the three cited papers were read as abstracts and citation records, not in full.
- This project was built with AI assistance. The full process, including a discarded
  synthetic-data prototype and every bug along the way, is documented in
  [`docs/07-build-log.md`](docs/07-build-log.md).
