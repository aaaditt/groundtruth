# 7. Build log: how this project was built

> Note: this log was written before the project was reorganised into this repository,
> so it refers to the working folder as `seismic-rhythm` and to a single root
> `README.md` / `CLAUDE.md`. The code is the same; only the folder layout changed, and
> the documentation was split into `docs/`.
>
> **The numbers in this log are historical.** They were produced with the original
> labels (Saturday–Sunday weekends everywhere, only 21 Dec – 6 Jan as "holiday").
> Labels were corrected on 2026-11-03; current numbers are in `docs/04-results.md`,
> and the change is recorded in `docs/10-work-log.md`.

This is a record of everything done in this conversation, in order. It covers the websites and links used, the tools and commands run, the choices made, the mistakes and how they were fixed, and the final results. It aims to be honest about what was actually checked and what wasn't.

---

## Part 1: Reading your class schedule

**Your question:** which presentation topic in your Foundations of Data Science class is the best?

**What I did:**

1. Your open Chrome tab was the course PDF on the BITS Pilani LMS (`lms.bits-pilani.ac.in/.../Proposal Presentation Schedule.pdf`, titled "Prensentation Evaluation.xlsx").
2. I tried to pull the text out of the page. That returned nothing, because PDF viewers don't expose text that way.
3. I took a **screenshot** of the tab to read page 1, then **scrolled down** and took another to read page 2.
4. I read all 17 topic rows and presentation dates (15, 17, 22 and 24 Sep 2026). I also found **your own group's row**: Aadit Chandra, Aradhya Gupta and Shraddha Pradeep, presenting on **22 Sep 2026**, with the title *"Learning Urban Activity Rhythms from Ambient Seismic Noise for Anomaly-Based Disruption Detection."*
5. I gave an opinion from the titles alone: machine-translation style, LLM sycophancy, vision-language models, and your seismic topic ranked high. Common dataset projects like flight delays and housing ranked lower.

No other websites were used in this part.

## Part 2: The chicken and the egg

This was answered from general knowledge. No tools or websites were used.

---

## Part 3: First prototype (built on synthetic data, later thrown away)

**Your request:** a working machine learning prototype that predicts the day of the week from vibrations, plus files you can give to Claude Code, explained for a beginner.

### 3.1 Checking what the sandbox could do

I work in a private cloud Linux machine, separate from your computer.

- I checked the Python version: **3.11**.
- I checked whether ObsPy, the standard Python library for seismology, was installed. It wasn't.
- I tested internet access to a real seismic data service with `curl https://service.iris.edu/fdsnws/dataselect/1/version`. It was **blocked (HTTP 403)** by the sandbox's network policy.
- I installed packages from PyPI with `pip install obspy scikit-learn pandas numpy matplotlib`. PyPI is allowed, so this worked.
- I tested three seismic data sites: **service.iris.edu** (IRIS/EarthScope), **data.raspberryshake.org** and **earthquake.usgs.gov**. All three were **blocked**.

### 3.2 Why I used synthetic data at first

Real seismic data sites were unreachable, so I wrote `synthetic_data.py`. It generates fake daily vibration profiles: weekday commute peaks at about 8am and 5:30pm, a flat weekend plateau, and random noise. The idea was to prove the full pipeline worked before real data arrived.

### 3.3 Files built

`requirements.txt`, `synthetic_data.py`, `features.py` (band-pass filtering and hourly RMS from raw waveforms), `fetch_real_data.py` (an ObsPy downloader that was never tested), `train.py` (random forest), `predict.py`, `README.md`, `CLAUDE.md` and `.gitignore`.

### 3.4 Problems and fixes

- **Bug:** `train.py` crashed because scikit-learn's `classification_report` needs a list of class names, and I had passed a dictionary. I fixed that.
- **Too easy:** the first synthetic run scored 100% on weekday vs weekend. I raised the noise level from 0.05 to 0.18 so the data was less artificially clean.
- **Result on synthetic data:** 100% on weekday vs weekend and 35% on day of week (guessing gets 14%).
- I zipped the project and sent it to you with a plot.

**Why this was the wrong direction:** you said the project has to rest on real datasets and real research papers. Everything in Part 3 was replaced.

---

## Part 4: Rebuilding on real data

**Your request:** no synthetic data. Use real databases and datasets from actual research papers and websites.

### 4.1 Checking which data sites were reachable

I asked the sandbox's network proxy for its status. Then I tested these sites:

| Site | Result |
|---|---|
| github.com | reachable |
| raw.githubusercontent.com | reachable |
| pypi.org | reachable |
| zenodo.org | blocked |
| huggingface.co | blocked |
| kaggle.com | blocked |

**GitHub was reachable.** That turned out to be the key to getting real data.

### 4.2 Web searches

I ran two searches first:

1. *"Lecocq 2020 global quieting seismic noise COVID dataset SeismoRMS github data"*. Useful results:
   - github.com/ThomasLecocq/2020_Science_GlobalQuieting, the paper's official companion repository
   - github.com/ThomasLecocq/SeismoRMS, the author's notebook for computing seismic RMS
   - The *Science* article page
   - An EGU blog post, *"The sound of Covid-silence"*
   - A *Scientific Reports* paper on lockdown noise in Gujarat, India
2. *"IRIS MUSTANG noise-psd web service hourly PSD format query"*. This found the documentation for IRIS's noise-spectrum service. I planned to use it as a backup, but it wasn't needed and wasn't used.

### 4.3 Downloading the real dataset

I cloned the paper's repository:

```
git clone --depth 1 https://github.com/ThomasLecocq/2020_Science_GlobalQuieting.git
```

It is about 437 MB. Inside it:

- **`PaperZero_RMS/`**: 173 CSV files, one per real seismometer. Each row is a 15-minute window. The columns hold RMS ground displacement in four frequency bands: 0.1–1, 1–20, **4–14** and 4–20 Hz. The paper treats 4–14 Hz as the human-activity band. Most files run from about **31 Oct 2019 to late May 2020**. A few Chinese "IC" stations go back to 2013, but they have one unlabeled column, so I skipped them.
- **`Supplementary Files/Table S1 - Lockdown stations.csv`**: for each station, the country, **city**, **population density**, **latitude and longitude**, **time zone**, and **official lockdown dates**.
- Table S2 lists stations without lockdowns, and Table S3 lists stations with data gaps. I opened both but didn't use them.
- The paper's Jupyter notebooks, which I checked to confirm that 4–14 Hz is their default band.

I also confirmed that stations I wanted as examples were present: **BE.UCC** (Brussels, the lead author's own station) and **AM.R091F** (a London Raspberry Shake).

### 4.4 Research papers found for citation

I ran two more searches to find related research to cite:

3. *"Díaz 2017 Urban seismology: on the origin of earth vibrations within a city"*. This found the *Scientific Reports* article (nature.com/articles/s41598-017-15499-y) and its PubMed and NASA ADS listings.
4. *"Groos Ritter 2009 time domain classification quantification seismic noise urban environment"*. This found the *Geophysical Journal International* article (academic.oup.com/gji/article/179/2/1213/663267).

**What I did and didn't verify:** I confirmed these papers exist, and checked their titles, journals, volumes and DOIs from the search results. **I did not open or read their full text.** How I describe them in the README comes from my background knowledge. Lecocq et al. 2020 is the only source whose data and code I actually used.

### 4.5 Deleting the synthetic parts

I deleted `synthetic_data.py`, the fake features CSV, and the old plots and models. Later I also deleted `fetch_real_data.py`, which had never been tested and no longer matched the new code. I removed `obspy` from `requirements.txt`.

### 4.6 The new pipeline, file by file

| File | What it does |
|---|---|
| `src/get_data.py` | Clones the Lecocq repository into `data/external/` |
| `src/features.py` | Converts each station's 15-minute data into **one row per local calendar day**: 24 hourly medians of log vibration, split into the day's **shape** (when it was busy) and its **level** (how busy overall) |
| `src/build_dataset.py` | Loops over the stations in Table S1, attaches city, density and lockdown date, and labels each day **baseline**, **holiday** (21 Dec–6 Jan) or **lockdown** |
| `src/common.py` | Shared settings: feature list and model (100-tree random forest) |
| `src/train_stations.py` | One model per station, tested with 5-fold cross-validation that **holds out whole weeks** |
| `src/train_global.py` | One model for all stations, always tested on **stations it never trained on** |
| `src/showcase_city.py` | Presentation plots for one city: weekly rhythm, confusion matrix, which hours matter |
| `src/detect_disruptions.py` | Anomaly detection on holidays and lockdowns |
| `src/predict.py` | Live demo: pick a station and a date, and the model guesses the day of the week |
| `run_all.sh` | Runs everything in order |

### 4.7 Problems and fixes

1. **Text encoding error.** Table S1 has accented city names and isn't UTF-8. I read it as `latin-1` instead.
2. **Missing time zone data.** Python couldn't find zones like `US/Pacific`. I installed the `tzdata` package and added it to `requirements.txt`.
3. **Dataset built:** 158 stations and 28,948 station-days.
4. **First test run timed out** after the 10-minute limit. It used 300 trees per model on a 2-CPU machine. I cut it to 100 trees on one core and ran it in the background, which took about 3 minutes.
5. **My own mistake:** a waiting loop I wrote (`pgrep -f`) matched its own command, so it never ended and hit another 10-minute timeout. The training had actually finished. I checked the log and carried on.
6. **Units and glitches.** This was the most important fix. The New York plot showed values around 10¹⁰, some anomaly scores were over 1,000, and every Saturday got the identical score 0.27. When I investigated:
   - **Stations store amplitude in different units.** New York's Raspberry Shake values average about 49, probably nanometres, while other stations are in metres (around 10⁻⁸).
   - **Some days had sensor glitches** (near-zero or huge values) that distorted averages and standard deviations.
   - **Fixes:** drop any 15-minute sample more than 100× above or below the station's median; use **robust statistics** (median and MAD instead of mean and standard deviation) for loudness and anomaly scores; cap z-scores at ±10; label plots as "× typical level at this station" instead of physical units.
   - I then **rebuilt the dataset** (158 stations, 28,749 days) and **reran everything**. All the numbers below come from that corrected run.
7. I looked at the plots to check they made sense. New York and Athens show clear weekday commute shapes with quieter Saturdays and Sundays, and the anomaly timeline has no absurd values.
8. I checked how accuracy relates to population density: **Spearman ρ = 0.36, p < 0.0001**.

### 4.8 Final results (real data, after the fixes)

**Models trained per station** (149 stations with at least 70 normal days, whole weeks held out):

| Metric | Result | Chance |
|---|---|---|
| Weekday vs weekend, balanced accuracy | **median 93.3%**; 60% of stations ≥ 90% | 50% |
| Exact day of week | **median 46.5%**, best 72.2% | 14.3% |

Showcase cities:

| Station | City | Weekday/weekend | Day of week |
|---|---|---|---|
| AM.R7885 (Raspberry Shake) | New York | 99.4% | 66.4% |
| HL.ATH | Athens | 99.4% | 69.0% |
| BE.UCC | Brussels | 99.4% | 47.9% |

- **Busier cities are easier.** Median weekday/weekend accuracy is 89% for the least dense third of stations, 91% for the middle third and 96% for the densest third. Remote stations such as Mammoth Lakes score close to chance.

**One model for all cities** (tested only on stations it never saw): 79.0% on weekday vs weekend and 29.7% on day of week.

**Disruption detection** (models trained on normal days only; median across 149 stations):

| | Normal days | Christmas/New Year | COVID lockdown |
|---|---|---|---|
| Weekdays the model calls "weekend" | 3% | 36% | 10% |
| Days flagged as unusual | 5% (set by design) | 18% | 23% |

**The most unusual days outside lockdown, found without any holiday list:**
- **New York:** 1 Jan, 25 Dec, **Thanksgiving (Thu 28 Nov 2019)**, 24 Dec
- **Athens:** 1 Jan, 25 Dec, 6 Jan (Epiphany), 26 Dec
- **Brussels:** 1 Jan, 25 Dec, and **Fri 1 Nov 2019 (All Saints' Day, a Belgian public holiday)**

**Live demo tests with `predict.py`:**

| Station, date | Actual day | Model's guess | Flagged as unusual? |
|---|---|---|---|
| New York, 12 Feb 2020 | Wednesday | Tuesday (37%). A wrong but close guess, which is normal for ordinary weekdays | No |
| New York, 28 Nov 2019 (Thanksgiving) | Thursday | **Sunday (68%)** | Yes |
| New York, 25 Dec 2019 | Wednesday | **Sunday (96%)** | Yes |
| Athens, 1 Apr 2020 (lockdown) | Wednesday | Tuesday (52%) | Yes |
| Brussels, 1 Nov 2019 (All Saints' Day) | Friday | **Sunday (42%)** | Yes |

### 4.9 Documentation and packaging

- **`README.md`**: the data sources, the three papers, the results, each machine learning idea explained using this project, how to run everything, and the limitations.
- **`CLAUDE.md`**: instructions for Claude Code. It includes strict rules (real data only, cite sources, keep testing honest), problems that are already solved, a suggested order for the slides, and optional extras such as checking flags against official holiday lists, a map of stations, and a simpler comparison model.
- I zipped the project as `seismic-rhythm.zip` (about 8.7 MB). **The 437 MB raw dataset is not in the zip.** `get_data.py` downloads it on your computer. The processed CSV, results, plots and trained models are included.
- I sent you 4 plots and the zip.

---

## What was NOT done

- **No new recordings were downloaded.** Every seismic site except GitHub was blocked, so all data comes from the Lecocq et al. 2020 repository and stops in mid-2020.
- **The Díaz 2017 and Groos & Ritter 2009 papers were not read in full.** Only their existence and citation details were checked.
- **No official holiday calendar was used.** Thanksgiving and All Saints' Day were matched by hand from general knowledge. Scoring the flags against official holiday lists is listed as a next step.
- **The pipeline hasn't been run on your computer yet.** It has only run in the cloud sandbox.
- **Your model was switched mid-conversation.** You changed it from Sonnet 5 to Opus 5 before Part 4. That has no effect on the code.

## All links used

- Course schedule (your Chrome tab): lms.bits-pilani.ac.in/moodle/pluginfile.php/44188/mod_resource/content/1/Proposal%20Presentation%20Schedule.pdf
- **Data used:** https://github.com/ThomasLecocq/2020_Science_GlobalQuieting
- Lecocq et al. 2020, *Science*: https://science.sciencemag.org/content/369/6509/1338/tab-figures-data (doi:10.1126/science.abd2438)
- SeismoRMS notebook: https://github.com/ThomasLecocq/SeismoRMS
- Díaz et al. 2017, *Scientific Reports*: https://www.nature.com/articles/s41598-017-15499-y
- Groos & Ritter 2009, *GJI*: https://academic.oup.com/gji/article/179/2/1213/663267
- IRIS MUSTANG noise-psd documentation (found, not used): https://services.iris.edu/mustang/noise-psd/1/
- Tried but blocked: service.iris.edu, data.raspberryshake.org, earthquake.usgs.gov, zenodo.org, huggingface.co, kaggle.com
- Packages installed from pypi.org: numpy, pandas, scikit-learn, matplotlib, joblib, tzdata (plus obspy, installed in Part 3 but no longer used)
