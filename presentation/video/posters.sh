#!/usr/bin/env bash
# One poster per clip: its LAST frame (what the audience sees while the clip holds).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out/posters
while read -r id sec; do
  npx remotion still "$id" "out/posters/$id.png" --frame=$((sec * 30 - 1)) --gl=angle --log=error
done <<'LIST'
S00-questions 45
S01-christmas 20
S02-promises 30
C1-city 75
C3-globe 40
C2-sea 60
S05-features 60
C4-forest 40
S06-weeks 36
S07-results 45
S08-mistakes 60
S09-lockdown 35
S10-weekends 48
C5-quake 45
S12-limits 22
S13-scorecard 22
S14-close 32
LIST
if [ -f out/S11-live.mp4 ]; then
  ffmpeg -y -loglevel error -sseof -0.2 -i out/S11-live.mp4 -frames:v 1 -update 1 out/posters/S11-live.png
fi
echo "posters in out/posters/"
