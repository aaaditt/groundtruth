#!/usr/bin/env bash
# Full pipeline, real data end to end (~10-15 min on a laptop).
set -e
python src/get_data.py
python src/build_dataset.py
python src/train_stations.py
python src/train_global.py
for s in AM.R7885 HL.ATH BE.UCC; do python src/showcase_city.py --station $s; done
python src/detect_disruptions.py --station AM.R7885

# Cross-country weekend analysis and proposal figures (no ML, pure exploration).
# weekend_signature.py writes the table that make_presentation_plots.py reads.
python src/weekend_signature.py
python src/make_presentation_plots.py
echo "ALL DONE"
