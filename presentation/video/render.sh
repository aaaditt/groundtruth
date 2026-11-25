#!/usr/bin/env bash
# Render every clip of the final talk to out/<id>.mp4 (1920x1080, 30 fps, H.264).
# Usage: bash render.sh            (all clips, in slide order)
#        bash render.sh C1-city    (one clip)
#        bash render.sh --holds    (the live deck's holds, src/cues.json -> out/holds/)
# --gl=angle uses the graphics card: the 3D cutscenes (C*) need it, and it is harmless
# for the 2D clips.
set -euo pipefail
cd "$(dirname "$0")"
if [ "${1:-}" = "--holds" ]; then
  # every hold clip registered in Root.tsx (camera stopped, city still moving)
  for id in $(npx remotion compositions --quiet 2>/dev/null | tr ' ' '
' | grep -- '-hold-'); do
    npx remotion render "$id" "out/holds/$id.mp4" --codec=h264 --crf=18 --gl=angle --log=error
    echo "rendered out/holds/$id.mp4"
  done
  exit 0
fi
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
