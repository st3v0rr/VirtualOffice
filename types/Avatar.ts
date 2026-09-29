// A layered avatar (LPC graphics), shared by client and server.
// The server only validates and stores the serialized string, the client composes the texture.

export type AvatarDescription = {
  body: string
  hair: string
  hairColor: string
  top: string
  bottom: string
}

type Option = { id: string; label: string }

// every body has a matching head and a body type, which picks the fitting clothes
export const BODIES = [
  { id: 'teen_light', label: 'Schlank, hell', bodyType: 'teen' },
  { id: 'female_bronze', label: 'Weiblich, bronze', bodyType: 'female' },
] as const satisfies readonly (Option & { bodyType: string })[]

export const HAIRS = [
  { id: 'none', label: 'Keine' },
  { id: 'bob', label: 'Bob' },
  { id: 'buzzcut', label: 'Kurz' },
  { id: 'curly_short', label: 'Locken' },
] as const satisfies readonly Option[]

// LPC ships every hair style in pre-rendered colors; the tinted ones multiply the white variant
export const HAIR_COLORS = [
  { id: 'dark_brown', label: 'Dunkelbraun', variant: 'dark_brown' },
  { id: 'blonde', label: 'Blond', variant: 'blonde' },
  { id: 'black', label: 'Schwarz', variant: 'black' },
  { id: 'red_tint', label: 'Rot (Tint)', variant: 'white', tint: 0xd04a2a },
  { id: 'blue_tint', label: 'Blau (Tint)', variant: 'white', tint: 0x4a7ad0 },
] as const satisfies readonly (Option & { variant: string; tint?: number })[]

export const TOPS = [
  { id: 'tshirt', label: 'T-Shirt' },
  { id: 'polo', label: 'Polo' },
  { id: 'cardigan', label: 'Strickjacke' },
] as const satisfies readonly Option[]

export const BOTTOMS = [
  { id: 'pants', label: 'Jeans' },
  { id: 'formal', label: 'Anzughose' },
] as const satisfies readonly Option[]

export const AVATAR_OPTIONS = {
  body: BODIES,
  hair: HAIRS,
  hairColor: HAIR_COLORS,
  top: TOPS,
  bottom: BOTTOMS,
} as const satisfies Record<keyof AvatarDescription, readonly Option[]>

// the order of the fields in the serialized string, never reorder (bump the version instead)
const FIELDS = [
  'body',
  'hair',
  'hairColor',
  'top',
  'bottom',
] as const satisfies readonly (keyof AvatarDescription)[]
const VERSION = '1'
const SEPARATOR = '.'

export const DEFAULT_AVATAR: AvatarDescription = {
  body: 'teen_light',
  hair: 'curly_short',
  hairColor: 'dark_brown',
  top: 'polo',
  bottom: 'pants',
}

/** e.g. "1.teen_light.curly_short.dark_brown.polo.pants", also used as cache key */
export function serializeAvatar(avatar: AvatarDescription) {
  return [VERSION, ...FIELDS.map((field) => avatar[field])].join(SEPARATOR)
}

/** null for anything that is not a valid avatar (unknown version, part or garbage) */
export function parseAvatar(value: unknown): AvatarDescription | null {
  if (typeof value !== 'string' || value.length > 200) return null
  const [version, ...parts] = value.split(SEPARATOR)
  if (version !== VERSION || parts.length !== FIELDS.length) return null
  const avatar = {} as AvatarDescription
  for (const [i, field] of FIELDS.entries()) {
    const options: readonly Option[] = AVATAR_OPTIONS[field]
    if (!options.some((option) => option.id === parts[i])) return null
    avatar[field] = parts[i]
  }
  return avatar
}

export function randomAvatar(): AvatarDescription {
  const pick = (options: readonly Option[]) =>
    options[Math.floor(Math.random() * options.length)].id
  return {
    body: pick(BODIES),
    hair: pick(HAIRS),
    hairColor: pick(HAIR_COLORS),
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
  }
}
