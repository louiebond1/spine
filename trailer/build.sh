#!/usr/bin/env bash
# Build Spine_Give_AI_a_Spine_Polished.mp4 from this folder.
# Optional: pass the approved cut (Spine_Give_AI_a_Spine.mp4) to re-extract the reused
# assets (soundtrack, fold frames 879-968, end-card plate 969). Otherwise the bundled ones are used.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out assets/plates

if [ "${1:-}" != "" ]; then
  ffmpeg -v error -y -i "$1" -vn -c:a pcm_s16le -ar 48000 -ac 2 assets/original_audio.wav
  ffmpeg -v error -y -i "$1" -vf "select='between(n\,879\,969)'" -vsync 0 -start_number 879 assets/plates/f%04d.png
fi

python3 render.py video out/video_only.mp4
python3 audio.py assets/original_audio.wav out/mix.wav

ffmpeg -v error -y -i out/video_only.mp4 -i out/mix.wav \
  -map 0:v -map 1:a -c:v copy \
  -af "alimiter=limit=0.84:level=false:attack=1:release=60" \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -movflags +faststart -shortest \
  out/Spine_Give_AI_a_Spine_Polished.mp4

ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,pix_fmt \
  -of default=nw=1 out/Spine_Give_AI_a_Spine_Polished.mp4
