// The animation state of a chibi. It is a plain mutable object, written by the
// player logic / network and read by <Chibi> in useFrame, so moving never re-renders React.

import type { DrinkId, Emote } from '../../../types/Emotes'

export { EMOTES, type Emote } from '../../../types/Emotes'
export type MotionState = 'idle' | 'walk' | 'sit'

// what the vending machine has; the chibi holds it for a while and takes sips
export const DRINKS = {
  coffee: { label: 'Kaffee', emoji: '☕', cup: '#fff6ea', fill: '#8a5a3c' },
  tea: { label: 'Tee', emoji: '🍵', cup: '#b5e8a3', fill: '#e9c27d' },
  soda: { label: 'Limo', emoji: '🥤', cup: '#ff9aa2', fill: '#ff9aa2' },
  water: { label: 'Wasser', emoji: '💧', cup: '#8fd3e8', fill: '#dff3ff' },
} as const satisfies Record<DrinkId, unknown>
export type Drink = DrinkId
export const DRINK_DURATION = 30

export type Motion = {
  state: MotionState
  // 0..1, how fast the chibi is walking (scales the bounce)
  speed: number
  // seconds (clock time) when the current state began, for the "plumps" when sitting down
  since: number
  emote: MotionEmote | null
  emoteSince: number
  // a drink in the hand, until the clock time `until`
  holding: { drink: Drink; until: number } | null
  // the hand is up (like at school) until lowered again
  handRaised: boolean
}

// the emotes, plus the little hop when taking a drink (not an action of its own)
export type MotionEmote = Emote | 'gulp'

export const createMotion = (): Motion => ({
  state: 'idle',
  speed: 0,
  since: 0,
  emote: null,
  emoteSince: 0,
  holding: null,
  handRaised: false,
})

// how much higher the hips are while sitting on a chair
export const SIT_LIFT = 0.13
export const EMOTE_DURATION: Record<MotionEmote, number> = {
  wave: 2.2,
  cheer: 1.6,
  clap: 2,
  hearts: 2,
  gulp: 0.5,
}
