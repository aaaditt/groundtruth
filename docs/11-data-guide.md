# 11. Data guide — where the data lives, how fresh it is, how we use it

Written 2026-11-03. Every "verified" claim below was checked by a live query on that
date; the queries are recorded in `docs/10-work-log.md`. Things not yet checked are
marked **unverified**.

---

## 1. What we are doing, in plain words

The project so far uses seismometer data from Oct 2019 to May 2020. We want **recent
data** for two things:

1. **Does the model still work?** Train on the old normal days, test on recent days the
   model has never seen.
2. **The UAE weekend experiment.** On 1 Jan 2022 the UAE moved its weekend from
   Fri-Sat to Sat-Sun. If we are really measuring people, the quietest days at a UAE
   seismometer should move on that date.

## 2. Is there an open, daily-updated "database"? Yes — but it's a network, not one site

There is no single seismic database. There is a **standard** called **FDSN web
services**, and many data centres speak it. You ask any of them the same kind of
question ("give me station X between date A and date B") and they answer in the same
format. Data is free and open to download, no account needed (verified for the three
below).

| Data centre | Covers | Example stations for us | Status |
|---|---|---|---|
| **EarthScope** (formerly IRIS), `service.earthscope.org` | Global professional networks; the main US archive | `II.UOSS` (Sharjah, UAE), `CN.MNTQ` (Montreal) | **Works** (verified) |
| **Raspberry Shake**, `data.raspberryshake.org` | Citizen seismometers in homes, offices, schools — mostly in cities | `AM.R1F39` (Dubai area), `AM.R85A6` (Abu Dhabi) | Reachable, but Python rejects its TLS certificate — see §5 |
| **EIDA** (European federation: ORFEUS, RESIF, ETH, NOA, ...) | European national networks | `CH.SGEV` (Geneva) | Routing works (verified for Geneva); Athens, Paris, Dombås **not found yet** |
| **USGS** | Earthquake catalogue (not ground-noise data) | — | Works; only needed for roadmap item 8 |

**How fresh is it?** New recordings keep arriving at these archives continuously. We
verified that EarthScope's pre-computed noise product (below) already had data for
`II.UOSS` from **2026-10-29**, five days before we checked. How close to real time raw
recordings arrive was **not measured**.

## 3. Two ways to get the data — and which one is the "nice" way

### Option A — MUSTANG noise-psd (recommended where available)

EarthScope runs a quality-control system called **MUSTANG** that, for every station it
archives, automatically computes the **noise spectrum for every hour** — how much
shaking there was at each frequency. It is updated as new data arrives.

Why this is the nice way:
- **Tiny downloads.** One hour of one station is a few hundred lines of text, instead of
  ~144,000 raw samples.
- **No signal processing on our side.** No instrument-response removal, no filtering.
- **It is basically what we already compute.** Average the spectrum over 4-14 Hz and you
  get one number per hour for the human-activity band. Our features are already hourly
  (24 hourly medians per day), so the rest of the pipeline fits.

Limits (be honest about these):
- **Different unit, solved.** MUSTANG gives acceleration power in decibels. We convert
  it to 4-14 Hz **displacement RMS in metres**, the quantity Lecocq et al. used
  (`groundtruth/mustang.py`: divide by (2πf)⁴, sum over the 4-14 Hz bins, square
  root). Even so, MUSTANG numbers are **never mixed** with Lecocq numbers in one model;
  only unit-free quantities are compared across the two.
- **Different processing.** One-hour spectra every 30 minutes, versus Lecocq's
  15-minute values. Each spectrum keeps MUSTANG's own timestamp (window start).
- **Only EarthScope-archived stations.** Not Raspberry Shake; most European stations
  are **unverified**.
- **Nyquist limit.** A channel sampling at 40 Hz covers up to 20 Hz, so 4-14 Hz is fine.
  `II.UOSS.10.BHZ` samples at 40 Hz (verified).

Endpoint (verified working):
`https://service.earthscope.org/mustang/noise-psd/1/query?target=II.UOSS.10.BHZ.M&starttime=2022-01-15&endtime=2022-01-16&format=text`

### Option B — raw waveforms + SeismoRMS (works everywhere, heavier)

Download raw recordings over FDSN and compute 15-minute RMS in 4-14 Hz exactly as
Lecocq et al. did (their `SeismoRMS` code). This matches the old data most closely and
works for Raspberry Shake and European stations too. Cost: much bigger downloads and
processing time.

**Plan:** use **Option A** for EarthScope stations (Sharjah first), **Option B** where
Option A is unavailable (Raspberry Shake, Europe), and check the two against each other
and against the old data on one station before trusting either.

### Option A is validated (2026-11-03)

`src/validate_route_a.py` compared MUSTANG with the Lecocq data on the same days
(Oct 2019 – Jun 2020), on 5 city stations plus 1 remote control station.

| Station | Days | Day-specific shape r (control ≈ 0) | Daily level r | Weekend acc. Lecocq | Weekend acc. MUSTANG |
|---|---|---|---|---|---|
| `BE.UCC` Brussels | 188 | 0.94 | 1.00 | 100.0% | 100.0% |
| `CN.MNTQ` Montreal | 196 | 0.91 | 0.97 | 100.0% | 95.7% |
| `CI.USC` Los Angeles | 181 | 0.96 | 1.00 | 100.0% | 98.5% |
| `EI.DSB` Dublin | 199 | 0.98 | 1.00 | 99.4% | 98.8% |
| `S1.AUKSC` Melbourne | 169 | 0.91 | 0.99 | 95.6% | 97.2% |
| `C1.MG01` Puerto Williams (control) | 197 | 0.92 | 0.99 | 50.1% | 49.6% |

"Day-specific" means each source's average day shape is subtracted first, so the shared
day/night cycle can't inflate the agreement; matching the wrong days gives r ≈ 0.00–0.05.
The weekend models are trained separately on each source, with identical days and
week-held-out folds. The control matters most. MUSTANG tracks the remote station's noise
just as faithfully, but finds no weekly rhythm there, just like the Lecocq data. So
it does not invent rhythm. It sees it where people make it.

**Coverage** (`src/survey_mustang.py`, `outputs/tables/mustang_coverage.csv`). Of the
103 non-Raspberry-Shake stations in the dataset, MUSTANG has 48 for 2020-01-15 and
32 still have data for 2026-10-01. **Latency:** on 2026-11-03 the latest data for
`II.UOSS.10.BHZ` was 2026-11-01, so about 2 days.

## 4. How the ML model uses the data (unchanged)

- **25 features per day:** convert to local time, take the median of the 4-14 Hz value
  for each hour → 24 numbers; subtract the day's mean → the day's **shape**; plus 1
  number for overall **level**.
- **Random forest** (`groundtruth/models.py`, `random_state=0`) predicts weekday vs weekend and
  the exact day.
- **Anomaly detection:** a day is flagged if its features fall beyond the 95th
  percentile of that station's normal days. No labels needed.
- **Honest testing:** train only on normal (baseline) days; hold out whole weeks for
  testing; never tune on holiday/lockdown days.
- **Never mix sources in one model.** A model trained on Lecocq data is never fed
  MUSTANG days, and the other way round. Live models are trained on each station's own
  recent normal days from one route only (see `docs/12-master-plan.md`).

## 5. Station-by-station status (verified 2026-11-03)

| Station | City | Old data? | Recent data? | Notes |
|---|---|---|---|---|
| `AM.R7885` | New York | Yes | **No** — stopped 2021-06-21 | Flagship demo city cannot be refreshed |
| `BE.UCC` | Brussels | Yes | **Yes, MUSTANG** (checked 2026-10-01) | Route A validated, see above |
| `CN.MNTQ` | Montreal | Yes | **Yes, MUSTANG** (checked 2026-10-01) | Route A validated, see above |
| `CI.USC`, `EI.DSB`, `S1.AUKSC`, `C1.MG01` | Los Angeles, Dublin, Melbourne, Puerto Williams | Yes | **Yes, MUSTANG** | Route A validated; `C1.MG01` is the control. 26 more in `outputs/tables/mustang_coverage.csv` |
| `CH.SGEV` | Geneva | Yes | Station open (via EIDA) | |
| `HL.ATH`, `FR.CURIE`, `NS.DOMB` | Athens, Paris, Dombås | Yes | **Not found yet** | Likely other European data centres |
| `II.UOSS` loc `10` | Sharjah, UAE | No | **Yes, continuous since 2020-02-13**; MUSTANG has Dec 2021, Jan 2022, Feb 2022 | **The UAE experiment is feasible.** Location `00` had a sensor swap on 2022-02-02 — avoid it. A university vault sensor may be quiet; whether it shows a weekly human rhythm is **untested** |
| `AM.R1F39`, `AM.R85A6`, `AM.S994C` | Dubai / Abu Dhabi | No | From 2023-10 / 2024-05 / 2026-01 | Start **after** the weekend change: can show the new weekend, not the switch |

**Raspberry Shake certificate issue.** `curl` (which uses the Windows certificate store)
connects fine; Python (which uses its own `certifi` list) reports "certificate has
expired". The fix is to make Python use the operating system's trusted certificates
(e.g. the `truststore` package), **not** to switch verification off.

## 6. Could this become a "live" tool?

Yes, in a modest way: a daily job that fetches yesterday's hourly noise for a few
stations, computes the 25 features, and reports the model's day-of-week guess and
anomaly score. That would make the "detect disruptions" idea genuinely current. It is
**not built**, and `docs/08-roadmap.md` keeps real-time streaming out of scope; a
once-a-day batch is the realistic version.

## 7. Sources

- FDSN web services standard — https://www.fdsn.org/webservices/
- EarthScope FDSN services — https://service.earthscope.org/
- MUSTANG noise-psd — https://service.earthscope.org/mustang/noise-psd/1/ ;
  Casey, R., et al. (2018). Assuring the Quality of IRIS Data with MUSTANG.
  *Seismological Research Letters* 89(2A), 630. doi:10.1785/0220170191
- Network `II` (IRIS/IDA, includes `UOSS`) — doi:10.7914/SN/II
- Network `AM` (Raspberry Shake) — doi:10.7914/SN/AM
- Network `BE` (Belgian Seismic Network) — doi:10.7914/SN/BE
- EIDA — https://www.orfeus-eu.org/data/eida/
- SeismoRMS — https://github.com/ThomasLecocq/SeismoRMS
