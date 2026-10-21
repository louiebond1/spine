#!/usr/bin/env bash
# Build Spine_Give_AI_a_Spine_Polished.mp4 ("Holds it together") from this folder.
# Optional: pass the approved cut (Spine_Give_AI_a_Spine.mp4) to re-extract the reused
# fold frames (879-968) and the end-card plate (969). Otherwise the bundled ones are used.
# The voiceover is read from assets/vo/voiceover.wav when present (see vo.py).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out assets/plates

if [ "${1:-}" != "" ]; then
  ffmpeg -v error -y -i "$1" -vf "select='between(n\,879\,969)'" -vsync 0 -start_number 879 assets/plates/f%04d.png
fi

python3 render.py video out/video_only.mp4
python3 score.py out/score.wav
VO=""
[ -f assets/vo/voiceover.wav ] && VO=assets/vo/voiceover.wav
python3 audio.py out/score.wav out/mix.wav $VO

# Normalise to -14.5 LUFS integrated with a look-ahead limiter (ceiling -2 dBFS) before AAC.
I=$(ffmpeg -nostats -i out/mix.wav -af ebur128 -f null - 2>&1 | awk '/I:/{v=$2} END{print v}')
GAIN=$(python3 -c "print(round(-14.5 - float('$I'), 2))")
python3 master.py out/mix.wav out/master.wav "$GAIN" -2.0
ffmpeg -v error -y -i out/video_only.mp4 -i out/master.wav \
  -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -movflags +faststart -shortest \
  out/Spine_Give_AI_a_Spine_Polished.mp4

ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,pix_fmt \
  -of default=nw=1 out/Spine_Give_AI_a_Spine_Polished.mp4
