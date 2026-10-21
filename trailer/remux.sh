#!/usr/bin/env bash
# Re-mix and re-mux the audio only (after a cue change), reusing out/video_only.mp4 and out/score.wav.
set -euo pipefail
cd "$(dirname "$0")"
python3 audio.py out/score.wav out/mix.wav
I=$(ffmpeg -nostats -i out/mix.wav -af ebur128 -f null - 2>&1 | awk '/I:/{v=$2} END{print v}')
GAIN=$(python3 -c "print(round(-14.5 - float('$I'), 2))")
python3 master.py out/mix.wav out/master.wav "$GAIN" -2.8
ffmpeg -v error -y -i out/video_only.mp4 -i out/master.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 320k -ar 48000 -ac 2 -movflags +faststart -shortest out/Spine_Give_AI_a_Spine_Polished.mp4
