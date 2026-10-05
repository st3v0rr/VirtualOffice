import { isEmoteMessage, type EmoteMessage } from '../../types/Emotes.ts'

// Everything a client sends is checked here before it gets into the room state or is
// passed on to the others. Invalid input returns null and is dropped.

// an avatar is a handful of part names and colours, so anything longer is not one
export const MAX_AVATAR_LENGTH = 1000
// the same limits as the input fields of the client
export const MAX_NAME_LENGTH = 24
export const MAX_CHAT_LENGTH = 300

// the avatar as JSON; the server doesn't know its parts, the clients sanitize them
export function validateAvatar(avatar: unknown): string | null {
  if (typeof avatar !== 'string' || avatar.length > MAX_AVATAR_LENGTH) return null
  try {
    const parsed = JSON.parse(avatar)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  } catch {
    return null
  }
  return avatar
}

export function sanitizeName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  return name.trim().slice(0, MAX_NAME_LENGTH)
}

export function sanitizeChatMessage(content: unknown): string | null {
  if (typeof content !== 'string') return null
  const text = content.trim().slice(0, MAX_CHAT_LENGTH)
  return text || null
}

export function validateEmote(emote: unknown): EmoteMessage | null {
  return isEmoteMessage(emote) ? emote : null
}

// raising or lowering the hand: { raised: true | false }, nothing else
export function validateHandRaised(message: unknown): boolean | null {
  if (typeof message !== 'object' || message === null) return null
  const { raised } = message as Record<string, unknown>
  return typeof raised === 'boolean' ? raised : null
}

export type PlayerUpdate = { x: number; y: number; anim: string; rot?: number }

// a position in map pixels and the animation key ("adam_run_left")
export function validatePlayerUpdate(message: unknown): PlayerUpdate | null {
  if (typeof message !== 'object' || message === null) return null
  const { x, y, anim, rot } = message as Record<string, unknown>
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (typeof anim !== 'string' || anim.length > 64) return null
  return {
    x: x as number,
    y: y as number,
    anim,
    rot: typeof rot === 'number' && Number.isFinite(rot) ? rot : undefined,
  }
}
