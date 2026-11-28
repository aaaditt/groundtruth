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

## Questions I should be ready for

- **Why a random forest and not deep learning?** About 115 days per station is too little
  for a deep network. A forest works well on small tables, and we can show which hours it
  looks at.
- **Why GroupKFold by week?** Days in the same week are alike. If one Tuesday trained the
  model and the next day tested it, the score would be flattering. Whole weeks stay
  together.
- **Why balanced accuracy?** There are five weekdays to every two weekend days. A model
  that always says "weekday" would get about 71% plain accuracy and learn nothing.
- **Why can't the live model cheat?** New days are marked "live" and can never enter
  training. The nightly-learning test is pre-registered and graded later.
