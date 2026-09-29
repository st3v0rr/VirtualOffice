// Layout of the LPC layer sheets in public/assets/lpc (see client/scripts/prepare-lpc.sh):
// 64x64 cells, one row per direction with the idle, run and sit frames next to each other.
// The composed avatar textures use the same layout.

export const CELL = 64

// row order, as in the LPC generator
export const DIRECTIONS = ['up', 'left', 'down', 'right'] as const

const COLUMN = { idle: 0, run: 2, sit: 10 }
export const SHEET_COLUMNS = 11
export const SHEET_WIDTH = SHEET_COLUMNS * CELL
export const SHEET_HEIGHT = DIRECTIONS.length * CELL

type AnimDefinition = {
  // the columns of the frames in a direction's row
  frames: number[]
  frameRate: number
  repeat: number
}

// our animation states (the same names as the old characters, so `anim` keeps working)
export const LPC_ANIMS: Record<'idle' | 'run' | 'sit', AnimDefinition> = {
  // LPC's idle is a slow breathing cycle
  idle: { frames: [0, 0, 1].map((i) => COLUMN.idle + i), frameRate: 2.5, repeat: -1 },
  // the players move at 200px/s, which fits the LPC run cycle better than the walk cycle
  run: { frames: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => COLUMN.run + i), frameRate: 12, repeat: -1 },
  sit: { frames: [COLUMN.sit], frameRate: 1, repeat: 0 },
}

export function frameIndex(direction: number, column: number) {
  return direction * SHEET_COLUMNS + column
}

// where the feet are in a cell, used to line the 64x64 frames up with the old 32x48 characters
export const FEET_Y = 62
// the old characters have their feet 24px below the sprite position
export const ORIGIN_Y = (FEET_Y - 24) / CELL
