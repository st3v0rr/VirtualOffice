import { createMotion, type MotionState, type Emote } from '../avatar/motion'

// Mutable per-player data written by the network and read by the scene every frame.

export type RemoteState = {
  // latest position from the server, in world units (feet)
  targetX: number
  targetZ: number
  rot: number
  state: MotionState
  // set when the player just got added, so it appears at its position without sliding
  fresh: boolean
  // an emote to play, set by the network, consumed by the scene
  emote: Emote | null
}

export const remotes = new Map<string, RemoteState>()

// my own position, for the camera, proximity and chair occupancy
export const me = {
  x: 0,
  z: 0,
  rot: 0,
  sittingOn: null as string | null,
  motion: createMotion(),
}

export type Direction = 'down' | 'up' | 'left' | 'right'

// the facing angle as one of the four directions the 2D sprites have
export function angleToDirection(rot: number): Direction {
  const a = Math.atan2(Math.sin(rot), Math.cos(rot))
  if (Math.abs(a) <= Math.PI / 4) return 'down'
  if (Math.abs(a) >= (Math.PI * 3) / 4) return 'up'
  return a > 0 ? 'right' : 'left'
}

export const DIRECTION_ANGLE: Record<Direction, number> = {
  down: 0,
  up: Math.PI,
  left: -Math.PI / 2,
  right: Math.PI / 2,
}

// "lucy_run_left" -> parts; the Phaser client animates players by this key
export function parseAnim(anim: string) {
  const [texture, action, dir] = anim.split('_')
  const state: MotionState = action === 'run' ? 'walk' : action === 'sit' ? 'sit' : 'idle'
  return { texture, state, dir: (dir ?? 'down') as Direction }
}

export function toAnim(texture: string, state: MotionState, rot: number, dir?: Direction) {
  const action = state === 'walk' ? 'run' : state
  return `${texture}_${action}_${dir ?? angleToDirection(rot)}`
}
