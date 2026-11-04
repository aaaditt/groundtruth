#!/usr/bin/env bash
# Full pipeline, real data end to end (~30 min on a laptop).
set -e
python src/get_data.py
python src/build_dataset.py
python src/train_stations.py
python src/train_global.py
for s in AM.R7885 HL.ATH BE.UCC; do python src/showcase_city.py --station $s; done
python src/detect_disruptions.py --station AM.R7885

# Stage 4: the five promises (score_days.py must run before the two scripts that read it)
python src/class_weight_check.py outputs/tables/class_weight_comparison.csv
python src/shape_vs_level.py
python src/score_days.py
python src/confusion_detector.py
python src/holiday_holdout.py
python src/transfer.py

# Cross-country weekend analysis and proposal figures (no ML, pure exploration).
# weekend_signature.py writes the table that make_presentation_plots.py reads.
python src/weekend_signature.py
python src/make_presentation_plots.py

# Recent data (downloads from EarthScope MUSTANG; cached in data/cache/, not committed)
python src/uae_experiment.py
python src/train_live.py
echo "ALL DONE"
