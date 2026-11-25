#!/usr/bin/env bash
# Render every clip of the final talk to out/<id>.mp4 (1920x1080, 30 fps, H.264).
# Usage: bash render.sh            (all clips, in slide order)
#        bash render.sh C1-city    (one clip)
# --gl=angle uses the graphics card: the 3D cutscenes (C*) need it, and it is harmless
# for the 2D clips.
set -euo pipefail
cd "$(dirname "$0")"
ids=("$@")
if [ ${#ids[@]} -eq 0 ]; then
  ids=(S00-questions S01-christmas S02-promises C1-city C3-globe C2-sea S05-features C4-forest
       S06-weeks S07-results S08-mistakes S09-lockdown S10-weekends C5-quake S12-limits
       S13-scorecard S14-close)
fi
for id in "${ids[@]}"; do
  npx remotion render "$id" "out/$id.mp4" --codec=h264 --crf=18 --gl=angle --log=error
  echo "rendered out/$id.mp4"
done
