# 22. The research papers: what each one did, and what it gave us

The talk's "Who listened to cities before us" slide (docs/21, beat 5) now shows **three**
papers. This file covers **all seven** we cite, so every speaker can answer a question
about any of them. Full citations and DOIs are in
[`docs/02-data-and-sources.md`](02-data-and-sources.md), "Papers".

**How much of each we read.** Lecocq et al. (2020): the data and code were downloaded,
inspected and used directly. The other six: the citation details were checked against the
publisher's page, and the summaries below come from their **abstracts**. Their full texts
were not read. Don't claim details beyond what is written here.

| Paper | City | On the slide? | What it gave this project |
|---|---|---|---|
| Lecocq et al. 2020, *Science* | 268 stations, worldwide | No (credited on "Where every recording comes from") | **Our data**, and the 4–14 Hz human band |
| Groos & Ritter 2009, *GJI* | Bucharest | No | Early evidence of daily and weekly cycles |
| Díaz et al. 2017, *Sci Rep* | Barcelona | **Yes**, row 1 | Which human sources make the noise |
| Cannata et al. 2021, *Solid Earth* | Eastern Sicily | No | Noise follows phone mobility data; we need no phones |
| Nimiya et al. 2021, *Sci Rep* | Tokyo | **Yes**, row 2 | Weekdays and Sundays sound different |
| Yang et al. 2022, *Sci Adv* | Long Beach | No | People as noise to subtract; we tested the opposite |
| Liu et al. 2025, *Nat Commun* | San Jose | **Yes**, row 3 | Needs new fibre; we use seismometers already in place |

---

## Lecocq et al. (2020): Global quieting of high-frequency seismic noise due to COVID-19 pandemic lockdown measures

*Science* 369, 1338–1343. doi:[10.1126/science.abd2438](https://doi.org/10.1126/science.abd2438)

- **What they did:** measured seismic noise at 268 stations around the world before and
  during the 2020 lockdowns.
- **What they found:** human-made seismic noise fell by up to 50% during lockdowns, the
  quietest stretch in the record. The 4–14 Hz band tracks human activity and shows daily
  and weekly cycles.
- **What we took from it:**
  - **The dataset itself.** Every 2019–20 result (R1–R13) comes from their published
    measurements and their station table (Table S1).
  - **The 4–14 Hz band** as the "people" band (docs/02, "Why the 4–14 Hz band").
  - **The lockdown periods**, used only as test days the model never trains on.
- **Where we go further:** they measured the drop in averages. We teach a model each
  station's normal week, and let its mistakes find unusual days.
- **Not on the slide because:** it's our data source, so it's credited on "Where every
  recording comes from" instead.

## Groos & Ritter (2009): Time domain classification and quantification of seismic noise in an urban environment

*Geophysical Journal International* 179(2), 1213–1231.
[Article](https://academic.oup.com/gji/article/179/2/1213/663267)

- **What they did:** studied urban seismic noise in Bucharest, before COVID.
- **What they found:** the noise has daily and weekly cycles. They separated short
  bursts (transients) from the steady background.
- **What we took from it:** early, independent evidence that a city's week is written in
  the ground, which is the premise our day-of-week model tests at scale.
- **Not on the slide because:** the team judged it not needed for the story. Díaz 2017 makes
  the same point more directly.

## Díaz et al. (2017): Urban seismology: on the origin of earth vibrations within a city

*Scientific Reports* 7, 15296. doi:[10.1038/s41598-017-15499-y](https://doi.org/10.1038/s41598-017-15499-y)

- **What they did:** put seismometers around Barcelona and traced vibrations to specific
  sources.
- **What they found:** road traffic, the metro and crowds at events each leave a mark,
  with clear day/night and weekday/weekend structure.
- **What we took from it:** the reason the shaking we model is *people*: the sources are
  traffic, trains and crowds. That's why we can read the day of the week from it.
- **Where we go further:** they explained one city's noise. We predict the day, one day at
  a time, at 149 seismometers.

## Cannata et al. (2021): Seismic evidence of the COVID-19 lockdown measures: a case study from eastern Sicily (Italy)

*Solid Earth* 12, 299–317. doi:[10.5194/se-12-299-2021](https://doi.org/10.5194/se-12-299-2021)

- **What they did:** used 18 stations of Italy's permanent network (INGV) in eastern
  Sicily through the lockdown.
- **What they found:** human-made noise fell by up to 50% in the densest areas, and its
  pattern over time matched Apple, Google and Facebook mobility data.
- **What we took from it:** confirmation that seismic noise follows how people move.
- **Where we go further:** they needed phone data to compare against. Our model needs
  none: its own mistakes find holidays, with no labels. This is row 3 of "Where they
  stopped, and where we start".
- **Not on the slide because:** the team judged it not relevant enough. The contrast with
  phone data stays on the "Where they stopped" slide.

## Nimiya, Ikeda & Tsuji (2021): Temporal changes in anthropogenic seismic noise levels associated with economic and leisure activities during the COVID-19 pandemic

*Scientific Reports* 11, 20439. doi:[10.1038/s41598-021-00063-6](https://doi.org/10.1038/s41598-021-00063-6)

- **What they did:** analysed Tokyo's MeSO-net from April 2017 to March 2021, by time of
  day and day of week.
- **What they found:** after the first state of emergency, weekday daytime noise recovered
  quickly and Sundays more slowly. They conclude that seismic noise can monitor social
  activity.
- **What we took from it:** independent evidence that weekdays and Sundays sound
  different, which is what our model learns from.
- **Where we go further:** they compared averages for types of day. We guess each single
  day, graded only on weeks the model never saw.

## Yang et al. (2022): Toward improved urban earthquake monitoring through deep-learning-based noise suppression

*Science Advances* 8(15), eabl3564. doi:[10.1126/sciadv.abl3564](https://doi.org/10.1126/sciadv.abl3564)

- **What they did:** built UrbanDenoiser, a neural network trained on noise from a dense
  array in Long Beach.
- **What they found:** removing city noise lets small earthquakes show.
- **What we took from it:** the opposite view to ours. They treat people as noise to
  subtract; we treat people as the signal. We tested the earthquake side of that in two
  pre-registered experiments (docs/17 and docs/20, Results 19 and 22). Subtracting a
  city's normal week did **not** help find earthquakes, and a simple rolling baseline did
  better.
- **Not on the slide because:** the team judged it not relevant enough. The contrast stays
  on "Where they stopped" (row 4) and in "The dare, done properly" (beat 23).

## Liu et al. (2025): Urban sensing using existing fiber-optic networks

*Nature Communications* 16, 3091. doi:[10.1038/s41467-025-57997-y](https://doi.org/10.1038/s41467-025-57997-y)

- **What they did:** turned 50 km of telecom fibre in San Jose into about 50,000 virtual
  sensors (distributed acoustic sensing).
- **What they found:** street-by-street maps of seismic source power that line up with
  traffic, land use and demographics.
- **What we took from it:** the state of the art for fine detail, and our contrast. It
  needs fibre access and dense equipment; we use public seismometers that are already in
  the ground, and a test runs every night.

---

### If someone asks "why did you leave out X?"

The slide shows one paper per idea: describing a city's noise (Díaz), how it changed with
the pandemic (Nimiya), and mapping it in fine detail (Liu). The others are cited in
docs/02 and summarised above. Lecocq is our data source, credited on its own slide.
