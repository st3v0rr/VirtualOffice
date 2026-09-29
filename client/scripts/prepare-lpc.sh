#!/usr/bin/env bash
# Copies the LPC layers used by the character editor into client/public/assets/lpc, keeping
# only the frames the office uses, so each layer is 704x256 instead of 832x2944.
#
# usage: client/scripts/prepare-lpc.sh <checkout of Universal-LPC-Spritesheet-Character-Generator>
#
# The generator's "universal" sheet has 64x64 cells and one row per direction (up, left, down,
# right): idle in rows 22-25, sit in 30-33, run in 34-37. Every layer gets one row per direction
# with 11 frames (see client/src/avatar/lpcLayout.ts):
#   0-1 idle (columns 0-1), 2-9 run (columns 0-7), 10 sitting on a chair (sit column 2)
set -euo pipefail

SRC="${1:?path to the LPC generator checkout}/spritesheets"
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/assets/lpc"
CELL=64
IDLE_ROW=22
SIT_ROW=30
RUN_ROW=34

extract() {
  local src="$SRC/$1" dest="$DEST/$2"
  mkdir -p "$(dirname "$dest")"
  local rows=()
  for direction in 0 1 2 3; do
    rows+=("(" \
      "(" "$src" -crop "$((2 * CELL))x$CELL+0+$(((IDLE_ROW + direction) * CELL))" +repage ")" \
      "(" "$src" -crop "$((8 * CELL))x$CELL+0+$(((RUN_ROW + direction) * CELL))" +repage ")" \
      "(" "$src" -crop "${CELL}x$CELL+$((2 * CELL))+$(((SIT_ROW + direction) * CELL))" +repage ")" \
      -background none +append ")")
  done
  magick "${rows[@]}" -background none -append -strip -define png:compression-level=9 "$dest"
  echo "$2"
}

# bodies: body + matching head
extract body/bodies/teen/light.png              body/teen_light.png
extract head/heads/human/male/light.png         head/teen_light.png
extract body/bodies/female/bronze.png           body/female_bronze.png
extract head/heads/human/female/bronze.png      head/female_bronze.png

# hair (the "adult" variants fit both body types), pre-rendered colors + white for tinting
for style in bob buzzcut curly_short; do
  for color in dark_brown blonde black white; do
    extract "hair/$style/adult/$color.png" "hair/$style/$color.png"
  done
done

# tops, one sheet per body type
for bodyType in teen female; do
  extract "torso/clothes/shortsleeve/tshirt/$bodyType/teal.png"             "top/tshirt/$bodyType.png"
  extract "torso/clothes/longsleeve/longsleeve2_polo/$bodyType/white.png"    "top/polo/$bodyType.png"
  extract "torso/clothes/longsleeve/longsleeve2_cardigan/$bodyType/maroon.png" "top/cardigan/$bodyType.png"
done

# bottoms: LPC uses the "thin" legs for both teen and female bodies
extract legs/pants/thin/navy.png       bottom/pants/thin.png
extract legs/formal/thin/charcoal.png  bottom/formal/thin.png
