// Emotes are only passed on, not stored; the server lets through only these.
// (The raised hand is no emote: it stays up until lowered, so it is player state.)

export const EMOTES = ['wave', 'cheer', 'clap', 'hearts'] as const
export type Emote = (typeof EMOTES)[number]

// what the vending machine has, sent as "drink:<id>"
export const DRINK_IDS = ['coffee', 'tea', 'soda', 'water'] as const
export type DrinkId = (typeof DRINK_IDS)[number]

export type EmoteMessage = Emote | `drink:${DrinkId}`

export function isEmoteMessage(value: unknown): value is EmoteMessage {
  if (typeof value !== 'string') return false
  if (EMOTES.includes(value as Emote)) return true
  const [kind, drink, ...rest] = value.split(':')
  return kind === 'drink' && rest.length === 0 && DRINK_IDS.includes(drink as DrinkId)
}
