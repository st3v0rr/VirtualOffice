import type { Emote } from '../avatar/motion'

// The emote buttons/keys and the symbols that rise above a player for an emote.
// The chibi's own animation for each emote is in avatar/Chibi.tsx.

export type EmoteButton = { emote: Emote; key: string; label: string; icon: string }

// 1-4 play an emote, 5 raises or lowers the hand
export const EMOTE_BUTTONS: EmoteButton[] = [
  { emote: 'wave', key: 'Digit1', label: 'Winken', icon: '👋' },
  { emote: 'cheer', key: 'Digit2', label: 'Jubeln', icon: '🎉' },
  { emote: 'clap', key: 'Digit3', label: 'Klatschen', icon: '👏' },
  { emote: 'hearts', key: 'Digit4', label: 'Herzen', icon: '💖' },
]
export const HAND_KEY = 'Digit5'

export function emoteForKey(code: string): Emote | null {
  return EMOTE_BUTTONS.find((b) => b.key === code)?.emote ?? null
}

// one flying piece above the head: a symbol or a coloured confetti flake.
// x: px from the centre, delay: s, turn: degrees of spin, rise: px upwards
export type Particle = {
  symbol?: string
  color?: string
  x: number
  delay: number
  turn: number
  rise: number
}

const CONFETTI_COLORS = ['#ff6b8b', '#ffd23f', '#5ad1a6', '#5aa9ff', '#b48cff', '#ff9f45']

// a fixed spread instead of Math.random(), so every client shows the same burst
const spread = (i: number, count: number, width: number) =>
  Math.round(((i + 0.5) / count - 0.5) * width + ((i * 37) % 11) - 5)

export const EMOTE_FX: Record<Emote, { duration: number; particles: Particle[] }> = {
  wave: { duration: 0, particles: [] },
  cheer: {
    duration: 1900,
    particles: Array.from({ length: 22 }, (_, i) => ({
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      x: spread(i, 22, 110),
      delay: (i % 4) * 0.06,
      turn: ((i * 97) % 540) - 270,
      rise: 44 + ((i * 29) % 34),
    })),
  },
  clap: {
    duration: 2200,
    particles: Array.from({ length: 5 }, (_, i) => ({
      symbol: '👏',
      x: spread(i, 5, 64),
      delay: i * 0.3,
      turn: i % 2 ? 14 : -14,
      rise: 62 + (i % 3) * 8,
    })),
  },
  hearts: {
    duration: 2400,
    particles: Array.from({ length: 6 }, (_, i) => ({
      symbol: i % 3 === 1 ? '💖' : '❤️',
      x: spread(i, 6, 70),
      delay: i * 0.25,
      turn: i % 2 ? 10 : -10,
      rise: 66 + (i % 3) * 10,
    })),
  },
}
