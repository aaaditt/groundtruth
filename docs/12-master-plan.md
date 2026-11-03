# GroundTruth: master plan for Claude Code

> **How to use this file.** This is your brief. Save it in the repo as
> `docs/12-master-plan.md`, read it in full, then read `README.md`, `CLAUDE.md`,
> `docs/04-results.md`, `docs/08-roadmap.md`, `docs/09-presentation-script.md`,
> `docs/10-work-log.md` and `docs/11-data-guide.md`. Then produce a plan in plan mode
> before you write any code.

> **Repository note (added when saved, 2026-11-03).** This brief was written by a
> separate AI chat that holds the original project vision, and relayed by Aadit. It is
> saved verbatim below. The schedule actually adopted (2-4 week deadline; report +
> presentation + live demo; public dashboard approved) and the points where we
> deliberately depart from this brief are recorded in `docs/10-work-log.md`, entry
> "2026-11-03 — Master plan adopted".
>
> **Superseding note (same day):** Aadit asked to treat GroundTruth as a genuine
> project, not a semester project. The phases below remain the source of detailed
> requirements, but they are now ordered by dependency and quality gates rather than a
> deadline, and the engineering base comes earlier. See `docs/10-work-log.md`, entry
> "2026-11-03 — Reframed: a genuine project".

---

## 0. The goal

GroundTruth has two goals, in this order:

1. **The semester project.** Deliver the five things the team promised in the proposal
   (22 Sep 2026, `docs/09`, slide 3), to a standard that would hold up under questioning.
   This has a deadline. It comes first and it must not be put at risk.
2. **A real, working tool.** It reads a city's daily rhythm from public seismometers,
   every day, automatically. For each city it publishes what day the ground thinks it
   was, how confident it is, and whether the day was unusual. All of this goes on a
   public dashboard that anyone can open.

The science track is the base the tool is built on. The tool must never change a number
in the report.

---

## 1. Before you plan: questions to ask Aadit

Ask these at the start of plan mode and don't schedule anything until you have answers:

1. **Final deadline, format and rubric** for the semester project (report? presentation?
   demo? viva?). It's on the BITS LMS. Plan backwards from it, and keep at least 2 days
   free for writing.
2. **Whether he's happy for the dashboard to be public** (GitHub Pages on
   `aaaditt/groundtruth`), and whether GitHub Actions can be enabled on the repo.

If he can't answer the deadline question yet, assume the deadline is **close**. Do
Phase 1 first and report when it's done.

---

## 2. Rules (in addition to `CLAUDE.md`, which still applies in full)

1. **Real data only, including in tests.** Test fixtures are small *real* excerpts
   (one or two station-weeks) committed under `tests/fixtures/`, with their source
   recorded. No generated, simulated or mocked signals anywhere.
2. **Honest evaluation, always.**
   - Train only on normal days: no lockdown days, no public holidays, nothing flagged.
   - Hold out whole weeks within a station and whole stations across stations.
   - Recent and live days are **test-only** unless a phase says otherwise.
   - Never tune on the days you then report detection results for.
   - Report null and negative results exactly as found, and never tune them away.
3. **Never mix data sources within one comparison.** The Lecocq data is displacement
   RMS. MUSTANG is PSD power in dB. Waveform-derived RMS is the third source. A model is
   trained and tested on **one source for one station**. Comparisons *across* sources use
   unit-free quantities only: correlation of day shapes, or rank of weekdays.
4. **The report's numbers are frozen once Phase 1 is complete.** Tag that commit
   `v1.0-semester`. Later phases may add sections to the docs, but they don't change
   Phase 1 numbers. If later work finds a Phase 1 bug, stop and tell Aadit. Don't fix it
   silently.
5. **Every phase ends with:**
   - a `docs/10-work-log.md` entry covering what was done and what was found;
   - updated numbers in `docs/04-results.md` and `README.md`;
   - new sources added to `docs/02-data-and-sources.md` with a DOI (including network
     DOIs such as `10.7914/SN/II` and `10.7914/SN/AM`);
   - a commit.
6. **Be a polite data client.**
   - Cache every download.
   - Never fetch the same data twice.
   - Rate-limit FDSN and MUSTANG requests.
   - Use a generic User-Agent such as `groundtruth/1.0 (+https://github.com/aaaditt/groundtruth)`,
     with no personal email in it.
   - Fix the Raspberry Shake SSL error with the OS trust store (`truststore`).
     **Never disable certificate verification.**
7. **Ethics line, to state in the docs:** the tool measures aggregate city activity from
   public scientific instruments. It identifies no individuals and does no surveillance.
   Don't frame it otherwise.
8. **The team is new to ML.** Explain decisions in plain language in the work log, and
   keep code comments beginner-friendly.

---

## 3. Phase 1: Semester deliverables (the five promises)

**Data:** the existing Lecocq et al. (2020) dataset only. No new acquisition in this phase.

### 1.0 Groundwork

- **Per-country weekend table.** Add `config/weekends.csv` with columns country code,
  weekend days and a `valid_from` date.
  - Saturday–Sunday is the default.
  - Friday–Saturday for Saudi Arabia, Israel and Palestine.
  - Saturday only for Nepal.
  - UAE is Friday–Saturday before 2022-01-01 and Saturday–Sunday from that date.
  - Check every entry against a cited source.
- **`is_weekend` follows the table.** It must depend on the date, not be fixed to
  Saturday–Sunday.
- **Public holidays.** Add the `holidays` package. For every station-day, record
  `is_public_holiday` using the country code from Table S1.
- **Label holidays and remove them from training.** Days that are public holidays get
  `period = "holiday"` and leave the training set. Keep 21 Dec–6 Jan as a separate
  `festive` label, so the old comparison can still be shown.
- **Fix the docs status.** Change it to "Proposal presented 22 Sep 2026; final
  evaluation: [date]."
- **Rerun everything after these label changes.** The README's current numbers came
  from the pre-proposal feasibility code. The semester numbers are whatever this rerun
  produces, so record both old and new numbers in the work log.

### 1.1 Promise 1: day-of-week model

- Rerun the per-station and global models with the corrected labels.
- **Report:** weekday-vs-weekend balanced accuracy, 7-class accuracy, the chance
  baseline, the per-station distribution, and confusion matrices for the showcase cities.
- **Keep the control-group analysis:** remote stations sitting near chance, and the
  correlation with population density.

### 1.2 Promise 2: shape vs loudness *(the most original claim, so do it carefully)*

- Train four feature sets under identical cross-validation:
  - **level only** (1 feature, which is what the field measures);
  - **shape only** (24 features);
  - **both** (25 features);
  - **level-of-each-hour without the per-day mean removed** (raw hourly log-RMS). This
    shows whether the decomposition itself helps.
- Run each with **random forest and logistic regression**.
- **Report:** median and IQR across stations; the number of stations where shape adds
  more than 2 percentage points over level alone; and a paired Wilcoxon test across
  stations.
- **Plot:** per-station paired dots for level-only vs both.
- If shape adds nothing, say so in exactly those words.

### 1.3 Promise 3: confusion as a detector

- **Confusion score** = 1 − P(true day of week), taken from out-of-fold predictions. For
  non-baseline days, use a model trained on all baseline days.
- **Compare** against the existing robust-distance anomaly score.
- **Ground truth:** public holidays from 1.0. Report precision, recall and PR-AUC per
  station, and the median.
- **Note on lockdowns:** they're a known multi-week disruption. Report them separately
  and don't mix them into holiday precision and recall.
- **Report** the top-20 confusion days per showcase city with their dates, then check
  each date against news or holiday calendars in a table. Mark each date as verified
  holiday, plausible event, or unexplained.

### 1.4 Promise 4: holiday hold-out test

- Holidays are now absent from training (from 1.0). For every held-out public holiday
  that falls on a weekday, report:
  - the share the model calls a weekend day;
  - its average P(Sunday);
  - the same two numbers for ordinary weekdays, as the comparison.
- **Break this down by holiday type** where possible: national holidays vs religious
  holidays vs "bridge" days.
- **Headline sentence for the report:** "On held-out public holidays the model said
  'weekend' X% of the time, vs Y% for ordinary weekdays."

### 1.5 Promise 5: cross-city transfer and how it fails

- **Region transfer matrix.** Train on one region, test on each other region
  (Europe / North America / Latin America / Asia-Pacific / Middle East & Africa, or
  whatever groups have enough stations). Show it as a heatmap.
- **Weekend-shift test.** Train the global model on Saturday–Sunday countries only,
  then predict for Salfit, Amatzia and Jeddah.
  - Report what it predicts for their Fridays and their Sundays. The hypothesis is that
    Fridays get called "Saturday" or "Sunday", and Sundays get called a weekday.
  - State that n = 3.
- **Failure analysis.** Which station features predict poor transfer? Check population
  density, latitude, sensor type (Raspberry Shake vs professional) and data gaps. Use
  simple correlations, not another model.

### 1.6 Extras, only if time allows before the deadline

- **Frequency-band test.** Repeat 1.1 on the 0.1–1, 1–20, 4–14 and 4–20 Hz bands. The
  physics predicts 0.1–1 Hz will do worst.
- **Station world map,** coloured by weekday-vs-weekend accuracy.

### 1.7 Report and slides

- Write `docs/13-final-report.md` following the course rubric, with every figure taken
  from `outputs/plots/`.
- Produce slide-ready figures at dpi 150 that are readable on a projector.
- Update `docs/06-presentation-guide.md` for the final talk.
- Make the live demo reproducible with `src/predict.py`.
- **Tag `v1.0-semester`.**

**Phase 1 is done when:**
- all five promises have a result, including null results;
- the numbers are consistent across `README.md`, `docs/04` and `docs/13`;
- `run_all.sh` reproduces everything from a clean clone.

---

## 4. Phase 2: Engineering base (turn the scripts into a tool)

Start only after `v1.0-semester` is tagged, or earlier if Aadit confirms the deadline is
far enough away.

- **Package.** Create the `groundtruth/` Python package (`data/`, `features/`, `models/`,
  `detect/`, `report/`). The `src/*.py` scripts become thin wrappers so
  `v1.0-semester` still reproduces exactly.
- **Config.** `config/stations.yaml` holds, for each station: network/station/location/
  channel, the data source (`lecocq`, `mustang` or `waveform`), time zone, country,
  city, coordinates, and the dates it's active.
- **CLI.** `groundtruth fetch | build | train | pulse | report`, using `typer` or
  `argparse`.
- **Tests.** `pytest` with real-data fixtures. Tests cover:
  - local-time conversion, especially daylight-saving days;
  - feature shapes;
  - glitch filtering;
  - week-grouped splits never leaking a week;
  - weekend labels that depend on the date (the UAE switch on 2022-01-01).
- **CI.** A GitHub Actions workflow runs the tests on every push.
- **Pinned dependencies.** Add obspy and truststore only now, when they're needed.

---

## 5. Phase 3: Recent and live data acquisition

There are two routes into one common format: one hourly value per station per local
hour, plus a `source` column.

- **Route A: MUSTANG `noise-psd`** for EarthScope-archived stations.
  - Average the PSD over 4–14 Hz to get one dB value per hour.
  - This route is lightweight and updated continuously.
- **Route B: waveforms → 15-minute RMS**, using the SeismoRMS method from Lecocq, for
  stations MUSTANG doesn't cover (every Raspberry Shake, including those in Dubai and
  Abu Dhabi).
  - Remove the instrument response, band-pass 4–14 Hz, then take RMS per 15-minute
    window.
- **Validation (required before any result uses this data):**
  - **Route B vs Lecocq.** Recompute Route B for `BE.UCC` over Nov 2019 – May 2020 and
    compare with the Lecocq file for the same station.
    - Expect a correlation of hourly values above 0.9.
    - Expect agreement in absolute level within the tolerance of the method.
    - If it fails, stop and debug. Don't proceed.
  - **Route A vs Route B.** For one EarthScope station over the same period, compare
    the *day shapes* (a unit-free check): the correlation of hourly profiles, and
    whether the ranking of weekdays agrees.
- **Station refresh.**
  - Find out where `HL.ATH`, `FR.CURIE` and `NS.DOMB` are archived now. Try EIDA
    routing and the national data centres.
  - Assemble a **live roster** of 10–20 urban stations that are online now. Include
    `BE.UCC`, `CN.MNTQ`, `CH.SGEV`, `II.UOSS.10`, the three UAE Raspberry Shakes, and
    city Raspberry Shakes on several continents.
  - Record each station's start and end dates, and any sensor swaps, in `stations.yaml`.

---

## 6. Phase 4: New science with recent data

- **Does the rhythm last? (temporal generalisation)**
  - For each live-roster station, train on its own history from one year and test on a
    later year, using the same source.
  - Report accuracy over time.
  - For stations in both datasets, check whether the 2019–20 day shape (Lecocq)
    correlates with the 2024–26 day shape (new source). This is a unit-free comparison.
- **The UAE weekend experiment** on `II.UOSS.10.BHZ` with MUSTANG data, Nov 2021 – Mar 2022.
  - Avoid location `00`, which had a sensor swap on 2022-02-02.
  - **Pre-register the test in the work log before looking at the data:** the quietest
    two-day pair moves from Fri–Sat to Sat–Sun after 2022-01-01.
  - Measure with the weekend-signature method from `docs/04` and a permutation test on
    the switch date.
  - Then check whether the Dubai and Abu Dhabi Raspberry Shakes (2023 onwards) show a
    Saturday–Sunday weekend.
  - **A null result counts.** The Sharjah sensor sits in a university vault and may
    simply be too quiet.
- **More natural experiments, if time allows.** Find other dated, city-wide behaviour
  changes covered by live stations:
  - Ramadan, where daily timing shifts;
  - daylight-saving switches, a nice test that the local-time handling is right;
  - big strikes or citywide events.
  - Write each one up the same way: hypothesis first, then data.

---

## 7. Phase 5: The tool, "City Pulse"

**What it is.** A public, static dashboard that updates once a day. There are no servers
to run.

- **Daily job.** A GitHub Actions scheduled workflow, once per day, run after the data
  services have yesterday's data (pick a sensible UTC hour and allow for latency).
  - For each live-roster station it fetches yesterday.
  - It computes the 25 features and runs that station's model.
  - It writes `site/data/<station>.json` and appends to `site/data/history/<station>.csv`.
- **Models for live use.**
  - Per station, per source.
  - Trained on a trailing 12 months of normal days, excluding public holidays and
    flagged days.
  - Retrained weekly.
  - Keep the model version and training window in the JSON, so every published number
    can be traced back to the model that produced it.
- **Dashboard** (GitHub Pages, plain HTML/JS or a small static framework, no backend):
  - **World map** of live stations, coloured by today's anomaly score.
  - **Per-city card:**
    - yesterday's date and actual day;
    - the model's guess, with probabilities for all 7 days;
    - the anomaly and confusion scores;
    - a "normal / unusual" badge;
    - a 60-day timeline with weekends and public holidays marked.
  - **"The week the ground saw":** the city's average weekly rhythm compared with this
    week.
  - **About page:** the science, the data sources with DOIs, the honest-evaluation rules
    and the limitations, all in plain language.
- **Alerts (optional):** when a station's anomaly score passes its threshold on a day
  that isn't a holiday, open a GitHub issue automatically with a date link, so a human
  can check what happened.
- **Monitoring:**
  - The workflow fails loudly on fetch errors.
  - Stations that go offline are marked "no data". **Never fill the gap with estimates.**
  - A status table on the dashboard shows when each station last updated.

**Tool v1 is done when:**
- the dashboard is live;
- at least 8 stations update daily for 7 days in a row with no manual action;
- every published number traces back to a model version and a source;
- the About page is complete.

---

## 8. Phase 6: Research extensions *(after the tool works)*

Ordered by expected value:

1. **Anomaly typing.** Cluster flagged days by *how* they deviate (quiet all day, late
   start, missing evening peak) and label the clusters against known events.
2. **Pooled temporal model.** A small 1-D CNN over the 24-hour shape, pooled across
   stations to avoid overfitting. Compare it with the random forest under the same
   cross-validation. Keep it only if it wins honestly.
3. **Residual earthquake detection** (`docs/08`, item 8). Use the learned noise floor to
   reveal small local earthquakes.
   - **Pick the station first:** it needs catalogued small events nearby (USGS or a
     regional catalogue).
   - **Compare** detection with and without the noise floor subtracted, at a matched
     false-alarm rate.
   - **This needs raw 15-minute RMS or waveforms,** not the daily table. The current
     pipeline's medians and glitch filter remove exactly the signal this is looking for.
   - **Treat it as a research spike** with its own pre-registered success criterion.
   - **Never describe it as earthquake *prediction*.**

---

## 9. What not to do

- Don't let any tool work delay the semester deliverables.
- Don't score the Lecocq-trained models on MUSTANG or waveform data.
- Don't add synthetic data anywhere, including to "fill gaps" in the dashboard.
- Don't run servers or databases. Static site plus scheduled job only.
- Don't change frozen `v1.0-semester` numbers.
- Don't overstate. Every claim on the dashboard and in the report should survive the
  question "how do you know?"

---

## 10. What to send back to Aadit after planning

1. Your phase plan with time estimates, scheduled backwards from the deadline.
2. Anything in this brief you disagree with or think is infeasible, and why.
3. The first concrete step you'll take.
