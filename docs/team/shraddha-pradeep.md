# Shraddha Pradeep: method, validation and the live system

**My part, in one line:** I placed the project in the research, designed how a day becomes
numbers and how the model is graded honestly, tested what does and doesn't help, and ran the
live system that scores new days every night.

The project is split three ways (see also [Aadit](aadit-chandra.md) and
[Aradhya](aradhya-gupta.md)). Each of us owns the parts we present.

## What I was responsible for

| Area | What it is | Where it lives |
|---|---|---|
| Literature | The papers we build on, and where they stopped | `docs/02-data-and-sources.md` ("Papers"), `docs/22-research-papers.md` |
| Method | The six steps from the ground to a guess | `docs/03-methodology.md` |
| Features: shape vs level | Each day becomes 25 numbers: 24 for the shape of the day, 1 for its level. Shape stops the model learning sensor loudness instead of people | `groundtruth/features.py` design, `src/shape_vs_level.py` (Result 6) |
| Honest grading | Train only on ordinary days; `GroupKFold` by week (and by station for the global model); balanced accuracy; class weighting | `src/class_weight_check.py` (Result 5), `src/memorisation.py` (Result 20) |
| What more data does | Richer features, more cities, more training: when they help and when they flatten | `src/weekday_experiment.py`, `src/more_data_experiment.py`, `src/plot_learning_curve.py` (Results 17, 18) |
| The live system | Models trained on recent data, scoring each new day every night; City Pulse; nightly learning | `src/train_live.py`, `src/pulse.py`, `.github/workflows/pulse.yml`, `site/today.html`, `docs/19` (Results 11, 13, 21) |

## What I present (docs/21)

5 Who listened to cities before us · 6 Where they stopped, and where we start · 12 From the
ground to a guess · 13 One day becomes 25 numbers · 14 A hundred trees vote · 15 Tested on
weeks it never saw · 16 How one guess is made · 24 What didn't work · 26 Does more data make
it smarter? · 30 What runs every night · 31 City Pulse

## The main point of each of my slides

These are in my own words, the way I say them in the talk. The full lines are in docs/21
and in the presenter window.

| Slide | The point |
|---|---|
| 5 Who listened before us | Barcelona (2017) connected city noise to traffic, the metro and crowds; Tokyo (2017–2021) showed weekday daytime noise came back quickly after the first state of emergency, Sundays more slowly; San Jose (2025) mapped activity street by street with 50 km of fibre-optic cable |
| 6 Where they stopped | They measured average patterns, in one city or one event, often with phone data or new equipment. We look at one day at a time, on 149 seismometers and then 33 cities, need no phone data, keep people as the signal, and use seismometers already in the ground |
| 12 The method in six steps | Prepare the data (one row per day, 4–14 Hz, faulty readings removed, local time), 25 features, calendar labels (only ordinary days train), a Random Forest of 100 trees, testing on whole unseen weeks, and unusual predictions to find unusual days |
| 13 One day becomes 25 numbers | 24 numbers for how active each hour was (the shape), 1 for how loud the whole day was against that station's usual activity (the level). The shape lets us compare stations |
| 14 A hundred trees vote | Each tree asks simple yes-or-no questions (e.g. was six in the morning still quiet?). On an unseen Wednesday, 97 of 100 trees say weekday, but they don't agree on which weekday |
| 15 Tested on unseen weeks | Whole weeks are kept together, five splits, and balanced accuracy, so always guessing "weekday" gets 50%, not about 71% |
| 16 How one guess is made | Real votes for 15 Jan 2020 in Brussels: Friday 31, Tuesday 25, Monday 23, Wednesday 5, weekend 3. The exact day is wrong (Friday) but weekday is right: better at weekday vs weekend than the exact day |
| 24 What didn't work | Lockdown weekdays didn't simply look like Sundays (only about a quarter were called weekend); shape-and-level features weren't better than raw hourly readings, just simpler to compare; one season, national holidays only |
| 26 More data | Weekday vs weekend reaches 97%; the exact day rises from 38% (100 days) to 57% (all days), then slows; one model for all 33 cities is worse in every city, *probably* because a Tuesday sounds different from city to city; giving it the whole week reaches 96% |
| 30 What runs every night | EarthScope publishes the data about two days later; a GitHub Action downloads it every morning at six; a fixed model (one year, never changed) and a learning model (predicts first, then learns) score each day; results go to the repository and Vercel |
| 31 City Pulse | Yesterday's result for each city; the fixed and learning models side by side (we don't expect a huge improvement; the final result comes in January, so these are early results); the predictions board, saved before the day |

## Questions I should be ready for

- **Why a random forest and not deep learning?** About 115 days per station is too little
  for a deep network. A forest works well on small tables, and we can show which hours it
  looks at.
- **Why keep whole weeks together when testing (GroupKFold by week)?** Days in the same
  week are alike. If one Tuesday trained the model and the next day tested it, the score
  would be flattering.
- **Why balanced accuracy?** There are five weekdays to every two weekend days. A model
  that always says "weekday" would get about 71% plain accuracy and learn nothing; balanced
  accuracy gives it 50%.
- **Why does one model for all 33 cities do worse?** We measured that it does, in every
  city. *Why* it does, we didn't test. Our best guess is that a Tuesday sounds different
  from one city to another, so say "probably".
- **Does the learning model actually help?** We don't know yet. The test was written down
  before the code (pre-registered, docs/19) and is graded in January. Until then the City
  Pulse numbers are early results. We don't expect a big improvement, because more data
  had already stopped helping much.
- **Why can't the live models cheat?** New days are marked "live" and can never enter
  training; the learning model always predicts a day *before* it learns from it.
