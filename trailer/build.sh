#!/usr/bin/env bash
# Build the current 63.7-second Collaboration Rework V2 directly from source.
set -euo pipefail
cd "$(dirname "$0")"
export SPINE_FONT_DIR="${SPINE_FONT_DIR:-$PWD/assets/fonts}"
mkdir -p out

python3 render.py video out/video_only.mp4
python3 score.py out/score.wav
VO=""
[ -f assets/vo/voiceover.wav ] && VO=assets/vo/voiceover.wav
python3 audio.py out/score.wav out/mix.wav $VO

# Normalise to -14.5 LUFS integrated with a look-ahead limiter (ceiling -2.8 dBFS) before AAC.
I=$(ffmpeg -nostats -i out/mix.wav -af ebur128 -f null - 2>&1 | awk '/I:/{v=$2} END{print v}')
GAIN=$(python3 -c "print(round(-14.5 - float('$I'), 2))")
python3 master.py out/mix.wav out/master.wav "$GAIN" -2.8
ffmpeg -v error -y -i out/video_only.mp4 -i out/master.wav \
  -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -movflags +faststart -shortest \
  out/Spine_Collaboration_Rework_V2.mp4

ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,pix_fmt \
  -of default=nw=1 out/Spine_Collaboration_Rework_V2.mp4

