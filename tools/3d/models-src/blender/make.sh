#!/bin/bash
# Usage: make.sh <script.py> <out-name> [extra blender args]
# Builds the model headless, exports raw GLB to the scratch dir, optimizes into public/models/<out-name>.glb
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SCR=/private/tmp/claude-501/-Users-DavidLiu/f47a44a5-4dfa-4aae-b40f-735bd11d5e6f/scratchpad/models-test
mkdir -p "$SCR/raw" "$SCR/renders"
script="$1"; name="$2"; shift 2
/opt/homebrew/bin/blender -b --factory-startup -P "$HERE/$script" -- --export "$@" 2>&1 | grep -E "SIZE|EXPORTED|RENDERED|Error|Traceback|line [0-9]|Exception" || true
cd "$ROOT"
npx gltf-transform optimize "$SCR/raw/$name.glb" "$ROOT/public/models/$name.glb" \
  --compress meshopt --flatten false --join false --instance false --palette false --simplify false \
  --texture-compress webp --texture-size 1024 2>&1 | grep -E "info|error" || true
ls -la "$ROOT/public/models/$name.glb"
