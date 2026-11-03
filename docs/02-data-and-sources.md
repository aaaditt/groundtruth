# 2. Data and sources

Everything in this repository is computed from **real seismometer recordings**.
There is no synthetic, simulated or generated data anywhere in the project.

## The dataset we use

| Field | Detail |
|---|---|
| **What** | RMS ground displacement, computed in 15-minute windows, in four frequency bands: 0.1–1 Hz, 1–20 Hz, **4–14 Hz**, 4–20 Hz |
| **Where from** | 173 seismic stations worldwide — a mix of professional research networks (IRIS/EarthScope, GEOSCOPE, national networks) and **Raspberry Shake** citizen-science seismometers installed in homes, schools and offices |
| **When** | Most stations: ~31 Oct 2019 → late May 2020. A few Chinese stations reach back to 2013 but have unlabelled columns, so we skip them |
| **Size** | ~437 MB (git clone) |
| **Source** | The official companion repository of Lecocq et al. (2020), *Science* — folder `PaperZero_RMS/` |
| **Link** | https://github.com/ThomasLecocq/2020_Science_GlobalQuieting |
| **How we get it** | Committed in this repository under `data/external/` — see [`PROVENANCE.md`](../data/external/PROVENANCE.md). `python src/get_data.py` still exists and will fetch it if the folder is ever missing, but no download is needed |

### The metadata table

The same repository contains `Supplementary Files/Table S1 - Lockdown stations.csv`,
which gives, for each station: country, **city**, **population density**, latitude,
longitude, **IANA time zone**, and the **official COVID-19 lockdown start date(s)**
for that location.

This table does a lot of work in this project:

- The **time zone** lets us convert UTC timestamps to local time. Rush hour is 8 a.m.
  where the seismometer is, not 8 a.m. UTC — without this the whole signal smears.
- The **lockdown date** gives us a labelled, externally-documented disruption to test
  our anomaly detector against.
- The **population density** lets us test the prediction that denser cities produce a
  stronger signal. (They do.)

Two further tables in the same folder (`Table S2 - Stations without lockdown`,
`Table S3 - Stations with datagaps`) were inspected but are not used.

### Why the 4–14 Hz band

Lecocq et al. use 4–14 Hz as their main "human activity" band, because it sits above
the natural microseism (ocean-generated noise, below ~1 Hz) and in the range where
traffic and machinery radiate energy. We follow the paper's choice; `src/features.py`
has `BAND = "4.0-14.0"` and it is a one-line change to test another band.

## Why this dataset and not raw waveforms

Raw seismic waveforms are enormous (100 samples/second/station) and would need
hundreds of gigabytes and hours of signal processing. The Lecocq repository publishes
exactly the intermediate product this project needs — RMS amplitude per 15-minute
window per band — already computed by the paper's authors with their published
method. Using it means:

- The preprocessing step is peer-reviewed rather than improvised by us.
- The whole project runs on a laptop in minutes.
- Anyone can reproduce our numbers exactly.

If you ever want fresher data, see `docs/08-roadmap.md` — the same RMS values can be
computed from live FDSN web services with the authors' own SeismoRMS notebook.

## Calendar sources (used for labels)

- **Weekend rules:** Wikipedia, *Workweek and weekend*, revision 933385566 of
  2019-12-31 —
  https://en.wikipedia.org/w/index.php?title=Workweek_and_weekend&oldid=933385566 .
  For countries not in that revision, and for the UAE's 2022 change: revision
  1381808266 of 2026-10-24 —
  https://en.wikipedia.org/w/index.php?title=Workweek_and_weekend&oldid=1381808266 .
  Pinned revisions, so the source can't silently change under us. No DOI exists. Where
  the table cites a primary legal source (e.g. Saudi Royal Decree M/51; Palestinian
  Labour Law No. 7 of 2000), that is noted in `config/weekends.csv`.
- **Public holidays:** the `holidays` Python package, version 0.108 —
  https://github.com/vacanza/holidays . No DOI found (searched Zenodo 2026-11-03).

## Candidate sources for recent data (not yet used for any result)

Being evaluated for roadmap item 5. Details and live-check results in
[`11-data-guide.md`](11-data-guide.md). No number in this repository comes from these yet.

- EarthScope FDSN web services — https://service.earthscope.org/
- MUSTANG noise-psd (pre-computed hourly noise spectra) —
  https://service.earthscope.org/mustang/noise-psd/1/ ; Casey, R., et al. (2018).
  Assuring the Quality of IRIS Data with MUSTANG. *Seismological Research Letters*
  89(2A), 630. doi:[10.1785/0220170191](https://doi.org/10.1785/0220170191)
- Network `II` (IRIS/IDA; station `UOSS`, Sharjah, UAE) — doi:[10.7914/SN/II](https://doi.org/10.7914/SN/II)
- Network `AM` (Raspberry Shake) — https://data.raspberryshake.org/ ; doi:[10.7914/SN/AM](https://doi.org/10.7914/SN/AM)
- Network `BE` (Belgian Seismic Network) — doi:[10.7914/SN/BE](https://doi.org/10.7914/SN/BE)
- EIDA (European data centres) — https://www.orfeus-eu.org/data/eida/

## Papers this project builds on

**Primary source (data + method):**

> **Lecocq, T., Hicks, S. P., Van Noten, K., et al. (2020).** Global quieting of
> high-frequency seismic noise due to COVID-19 pandemic lockdown measures.
> *Science*, 369(6509), 1338–1343. doi:[10.1126/science.abd2438](https://doi.org/10.1126/science.abd2438)

Measured seismic noise at 268 stations worldwide and showed that human-generated
seismic noise dropped by up to 50% during COVID-19 lockdowns — the quietest period in
the record. Established that the 4–14 Hz band tracks human activity, and documented
the daily and weekly cycles we exploit here.
Companion repo: https://github.com/ThomasLecocq/2020_Science_GlobalQuieting
Method notebook: https://github.com/ThomasLecocq/SeismoRMS

**Supporting literature:**

> **Díaz, J., Ruiz, M., Sánchez-Pastor, P. S., & Romero, P. (2017).** Urban seismology:
> on the origin of earth vibrations within a city. *Scientific Reports*, 7, 15296.
> doi:[10.1038/s41598-017-15499-y](https://doi.org/10.1038/s41598-017-15499-y)

Deployed seismometers in Barcelona and traced specific vibration sources — road
traffic, the metro, crowds at events — showing clear day/night and weekday/weekend
structure in urban seismic noise.

> **Groos, J. C., & Ritter, J. R. R. (2009).** Time domain classification and
> quantification of seismic noise in an urban environment. *Geophysical Journal
> International*, 179(2), 1213–1231.
> [Article](https://academic.oup.com/gji/article/179/2/1213/663267)

A pre-COVID study of urban seismic noise (Bucharest) that characterised its daily and
weekly cycles and separated transient sources from steady background noise.

**Honesty note:** the Lecocq et al. data and code were downloaded, inspected and used
directly. The Díaz and Groos & Ritter papers were identified through literature search
and are cited for context — their citation details were verified, but their full texts
were not read during this build. Read them before the presentation if you plan to
describe them in detail.

## Where this project goes beyond the papers

Those papers **describe and measure** urban seismic rhythms. This project **learns**
them with machine learning, tests that learning honestly across ~150 cities, and turns
it into a disruption detector that is validated against holidays and lockdowns it was
never shown. The specific framing — day-of-week classification as a proof that the
rhythm is learnable, plus unsupervised anomaly detection on top — is ours.
