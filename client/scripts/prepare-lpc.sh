#!/usr/bin/env bash
# Copies the LPC layers used by the character editor into client/public/assets/lpc and
# keeps only the animation rows we need, so each layer is ~576x1024 instead of 832x2944.
#
# usage: client/scripts/prepare-lpc.sh <checkout of Universal-LPC-Spritesheet-Character-Generator>
#
# The generator's "universal" sheet has 64x64 cells and one row per direction (up, left, down,
# right). Rows we keep, in this order (see LPC_ROWS in client/src/avatar/lpcLayout.ts):
#   walk 8-11 (9 frames), idle 22-25 (2 frames), sit 30-33 (3 frames), run 34-37 (8 frames)
set -euo pipefail

SRC="${1:?path to the LPC generator checkout}/spritesheets"
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/assets/lpc"
CELL=64
WIDTH=$((9 * CELL))

# rows (first row of each 4-direction block) to keep
BLOCKS=(8 22 30 34)

extract() {
  local src="$SRC/$1" dest="$DEST/$2"
  mkdir -p "$(dirname "$dest")"
  local parts=()
  for row in "${BLOCKS[@]}"; do
    parts+=("(" "$src" -crop "${WIDTH}x$((4 * CELL))+0+$((row * CELL))" +repage ")")
  done
  magick "${parts[@]}" -background none -append -strip -define png:compression-level=9 "$dest"
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
