#!/usr/bin/env bash
# Copies the Spine 2.0 recordings and screenshots from the spine-2 branch into public/assets.
# They are the only product imagery the film uses. Run from anywhere inside the repository.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
git -C "$here" fetch origin spine-2 --quiet
mkdir -p "$here/public/assets/clips" "$here/public/assets/stills"
for f in $(git -C "$here" ls-tree --name-only origin/spine-2 marketing/clips/); do
  git -C "$here" show "origin/spine-2:$f" > "$here/public/assets/clips/$(basename "$f")"
done
for f in $(git -C "$here" ls-tree --name-only origin/spine-2 marketing/ | grep '\.png$'); do
  git -C "$here" show "origin/spine-2:$f" > "$here/public/assets/stills/$(basename "$f")"
done
echo "sources ready in public/assets"
