# Aadit Chandra: data pipeline, models and the talk

**My part, in one line:** I placed the project in the research, turned the published
seismic data into a dataset, trained the day-of-week models, built the alarm from their mistakes, extended it to seven years and 33
cities, and built the presentation deck.

The project is split three ways (see also [Shraddha](shraddha-pradeep.md) and
[Aradhya](aradhya-gupta.md)). Each of us owns the parts we present.

## What I was responsible for

| Area | What it is | Where it lives |
|---|---|---|
| Literature | The papers we build on, and where they stopped | `docs/02-data-and-sources.md` ("Papers"), `docs/22-research-papers.md` |
| Data pipeline | Download the Lecocq et al. (2020) data; turn 15-minute readings into one row per station-day, in **local** time, with sensor glitches filtered out | `src/get_data.py`, `src/build_dataset.py`, `groundtruth/features.py`, `groundtruth/stations.py` |
| Day-of-week models | One random forest per station, and one global model across stations | `src/train_stations.py`, `src/train_global.py`, `groundtruth/models.py` (Results 1–3) |
| Disruption alarm | Score how surprised the model is by each day; unusual days rise to the top | `src/detect_disruptions.py`, `src/confusion_detector.py`, `groundtruth/detect.py` (Results 4, 8) |
| Seven years, 33 cities | 2019–2026 history from IRIS MUSTANG, the lockdown seen twice, the time-travel globe | `src/history.py`, `groundtruth/history.py`, `site/globe.html` (Results 14, 15) |
| Ask the ground | The model's out-of-fold guess for any city on any day since 2019 | `src/ask.py`, `groundtruth/ask.py`, `site/ask.js` (Result 16) |
| The talk | The web deck, its clips, and the online presenter windows | `site/talk/`, `src/talk_build.py`, `presentation/` |

## What I present (docs/21)

1 You shook the ground today · 2 Weekday or weekend? · 3 Last time · 4 What a seismometer
records · 5 Who listened to cities before us · 6 Where they stopped, and where we start · 17 What the model looks at · 18 Where it gets it wrong · 19 It reads the day ·
20 Its mistakes find holidays (second half) · 21 From a mistake to an alarm · 25 Now scale
it · 29 Ask the ground · 33 Five promises · 34 Still useless?

## Questions I should be ready for

- **Why only three papers on the slide?** One per idea: describing a city's noise
  (Barcelona), how it changed in the pandemic (Tokyo), and mapping it in fine detail
  (San Jose). All seven we cite, and what each gave us, are in docs/22.
- **How is ours different from them?** They measured averages, in one city or one event.
  We guess one day at a time, on weeks the model never saw, at 149 seismometers and then
  33 cities, with no phone data and with seismometers already in the ground.

- **Why local time?** Rush hour is 8 a.m. local. Averaging in UTC would smear every city's
  day across the wrong hours.
- **Why filter glitches and use median/MAD?** Some sensors report near-zero or huge values.
  Without robust statistics, anomaly scores reach the thousands.
- **Why does the alarm work?** The model learned how people behave, not the calendar. A
  holiday on a Wednesday looks like a Sunday, so the model is "surprised", and that
  surprise is the alarm. Normal days are scored out-of-fold, so the alarm is never graded
  on days it trained on.
- **Why compare a day with the same weekday over the last 8 weeks on the globe?** Stations
  drift over years, so a fixed baseline year would mislead.
