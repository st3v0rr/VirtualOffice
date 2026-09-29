// Layout of the LPC layer sheets in public/assets/lpc (see client/scripts/prepare-lpc.sh):
// 64x64 cells, blocks of 4 rows (one per direction), in the order walk, idle, sit, run.

export const CELL = 64
export const SHEET_COLUMNS = 9
export const SHEET_WIDTH = SHEET_COLUMNS * CELL
export const SHEET_HEIGHT = 16 * CELL

// row order inside a block, as in the LPC generator
export const DIRECTIONS = ['up', 'left', 'down', 'right'] as const

const BLOCK = { walk: 0, idle: 1, sit: 2, run: 3 }

type AnimDefinition = {
  block: number
  frames: number[]
  frameRate: number
  repeat: number
}

// our animation states (the same names as the old characters, so `anim` keeps working)
export const LPC_ANIMS: Record<'idle' | 'run' | 'sit', AnimDefinition> = {
  // LPC's idle is a slow breathing cycle
  idle: { block: BLOCK.idle, frames: [0, 0, 1], frameRate: 2.5, repeat: -1 },
  // the players move at 200px/s, which fits the LPC run cycle better than the walk cycle
  run: { block: BLOCK.run, frames: [0, 1, 2, 3, 4, 5, 6, 7], frameRate: 12, repeat: -1 },
  // column 2 of the sit block is sitting on a chair (0 and 1 are sitting on the floor)
  sit: { block: BLOCK.sit, frames: [2], frameRate: 1, repeat: 0 },
}

export function frameIndex(block: number, direction: number, column: number) {
  return (block * 4 + direction) * SHEET_COLUMNS + column
}

// where the feet are in a cell, used to line the 64x64 frames up with the old 32x48 characters
export const FEET_Y = 62
// the old characters have their feet 24px below the sprite position
export const ORIGIN_Y = (FEET_Y - 24) / CELL
