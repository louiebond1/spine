#!/usr/bin/env bash
# grab.sh <clip-number> <frame> <x> <y> <w> <h> <out.png> : one exact source frame, cropped, at native size
set -euo pipefail
clip=$(ls "$(dirname "$0")/../public/assets/clips/$1"-*.mp4)
ffmpeg -v error -y -i "$clip" -vf "select=eq(n\,$2),crop=$5:$6:$3:$4" -frames:v 1 "$7"
