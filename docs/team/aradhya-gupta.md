# Aradhya Gupta: data sources, the signal and the experiments

**My part, in one line:** I traced where every recording comes from, showed which shaking is
people and which is the sea, and ran the experiments that test the idea: holidays, other
regions, the UAE's weekend change, and earthquakes.

The project is split three ways (see also [Aadit](aadit-chandra.md) and
[Shraddha](shraddha-pradeep.md)). Each of us owns the parts we present.

## What I was responsible for

| Area | What it is | Where it lives |
|---|---|---|
| Data sources | Every network's name and DOI from the FDSN registry; station coordinates checked against FDSN, because Table S1 has some wrong | `src/sources_export.py`, `site/data/sources.json`, `outputs/tables/history_station_coords.csv` |
| Research map | Every seismometer on a map, scored | `src/export_site_research.py`, `site/research.html` |
| Which shaking is us | The spectrum: slow ocean waves vs fast human shaking; the band test shows the sea band can't read the week | `src/band_test.py` (Result 12) |
| Holidays | Which kinds of holiday the model catches, held out by type | `src/holiday_holdout.py` (Result 7) |
| Other regions | A model trained in one region, tested in another, and how it fails | `src/transfer.py` (Result 9) |
| The UAE weekend change | A pre-registered natural experiment: the UAE moved its weekend in 2022 | `src/uae_experiment.py`, `docs/14` (Result 10) |
| Earthquakes | Does subtracting the people reveal small earthquakes? Two pre-registered tests: no | `src/noise_floor.py`, `src/quake_waveform.py`, `docs/17`, `docs/20` (Results 19, 22) |
| Website tour and game | The front page tour and "Guess the day" | `site/index.html`, `site/tour.js`, `site/game.html` |

## What I present (docs/21)

7 Seismometers on six continents · 8 Where every recording comes from · 9 Two kinds of
shaking · 10 The spectrum · 11 The sea band can't read the week · 20 Its mistakes find
holidays (first half) · 22 The weekend moves · 23 The dare, done properly · 27 Everything we
built · 28 The front page · 32 Guess the day

## Questions I should be ready for

- **Why 4–14 Hz?** Below about 1 Hz the shaking is ocean waves, with no office hours. Engines,
  wheels and feet shake at several cycles a second. The band test shows only the human
  band carries the week.
- **What does pre-registered mean?** We wrote down the window, the metric and the exclusions
  *before* looking at the result, so we couldn't tune the test to make it pass. Those
  sections of docs/14, 17 and 20 are frozen.
- **The earthquake result was negative. Isn't that a failure?** It's a real answer. A city's
  weekly rhythm is the right model for reading the day, and the wrong one for a quake that
  lasts seconds. A simple rolling baseline did better. We detect quakes that happened; we
  never predict them.
- **Why not take station positions from Table S1?** It puts some stations in the wrong
  country (Nilore in Paraguay, Davao in Malaysia), so every coordinate is checked against
  the FDSN station service.
