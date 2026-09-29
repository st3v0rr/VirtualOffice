// The animation state of a chibi. It is a plain mutable object, written by the
// player logic / network and read by <Chibi> in useFrame, so moving never re-renders React.

export type MotionState = 'idle' | 'walk' | 'sit'
export type Emote = 'wave' | 'cheer' | 'hop'

export type Motion = {
  state: MotionState
  // 0..1, how fast the chibi is walking (scales the bounce)
  speed: number
  // seconds (clock time) when the current state began, for the "plumps" when sitting down
  since: number
  emote: Emote | null
  emoteSince: number
}

export const createMotion = (): Motion => ({
  state: 'idle',
  speed: 0,
  since: 0,
  emote: null,
  emoteSince: 0,
})

// how much higher the hips are while sitting on a chair
export const SIT_LIFT = 0.13
export const EMOTE_DURATION: Record<Emote, number> = { wave: 2.2, cheer: 1.6, hop: 0.5 }
