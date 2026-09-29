// The look of a chibi: a few part names and colours. It is synced as JSON in the
// `avatar` field of the player, so keep it small and always validate what comes in.

export const HAIR_STYLES = ['bob', 'spiky', 'pigtails', 'bun'] as const
export const TOP_STYLES = ['tshirt', 'hoodie', 'sweater'] as const
export const BOTTOM_STYLES = ['pants', 'shorts', 'skirt'] as const

export type HairStyle = (typeof HAIR_STYLES)[number]
export type TopStyle = (typeof TOP_STYLES)[number]
export type BottomStyle = (typeof BOTTOM_STYLES)[number]

// the 2D sprite the avatar shows up as in the Phaser client
export const PRESET_TEXTURES = ['adam', 'ash', 'lucy', 'nancy'] as const
export type PresetTexture = (typeof PRESET_TEXTURES)[number]

export type Avatar = {
  skin: string
  hair: HairStyle
  hairColor: string
  top: TopStyle
  topColor: string
  bottom: BottomStyle
  bottomColor: string
  // which 2D character represents this avatar for players of the Phaser client
  texture: PresetTexture
}

export const LABELS: Record<HairStyle | TopStyle | BottomStyle, string> = {
  bob: 'Bob',
  spiky: 'Strubbel',
  pigtails: 'Zöpfe',
  bun: 'Dutt',
  tshirt: 'T-Shirt',
  hoodie: 'Hoodie',
  sweater: 'Pulli',
  pants: 'Hose',
  shorts: 'Shorts',
  skirt: 'Rock',
}

// soft, toy-like colours; the skin tones cover light to dark
export const SKIN_COLORS = ['#ffe3d3', '#f9d0b4', '#eab48f', '#c98d66', '#9a6446', '#6e4531']
export const HAIR_COLORS = [
  '#4a3a35',
  '#8a5a3c',
  '#e9c27d',
  '#f2e6c9',
  '#d9735b',
  '#f4a6c0',
  '#9fb8f0',
  '#a8dcc4',
]
export const CLOTH_COLORS = [
  '#ff9aa2',
  '#ffb870',
  '#ffe08a',
  '#b5e8a3',
  '#8fd3e8',
  '#9fb2ff',
  '#c9a7f5',
  '#f5f0e6',
  '#5d6b8a',
  '#3f4652',
]

// the four characters of the 2D client, rebuilt as chibis
export const PRESETS: Record<PresetTexture, Avatar> = {
  adam: {
    skin: SKIN_COLORS[1],
    hair: 'spiky',
    hairColor: HAIR_COLORS[1],
    top: 'tshirt',
    topColor: CLOTH_COLORS[4],
    bottom: 'pants',
    bottomColor: CLOTH_COLORS[8],
    texture: 'adam',
  },
  ash: {
    skin: SKIN_COLORS[3],
    hair: 'bob',
    hairColor: HAIR_COLORS[0],
    top: 'hoodie',
    topColor: CLOTH_COLORS[3],
    bottom: 'pants',
    bottomColor: CLOTH_COLORS[9],
    texture: 'ash',
  },
  lucy: {
    skin: SKIN_COLORS[0],
    hair: 'pigtails',
    hairColor: HAIR_COLORS[4],
    top: 'sweater',
    topColor: CLOTH_COLORS[6],
    bottom: 'skirt',
    bottomColor: CLOTH_COLORS[0],
    texture: 'lucy',
  },
  nancy: {
    skin: SKIN_COLORS[2],
    hair: 'bun',
    hairColor: HAIR_COLORS[2],
    top: 'tshirt',
    topColor: CLOTH_COLORS[1],
    bottom: 'shorts',
    bottomColor: CLOTH_COLORS[5],
    texture: 'nancy',
  },
}

export const DEFAULT_AVATAR = PRESETS.adam

const COLOR = /^#[0-9a-f]{6}$/i
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback
const color = (value: unknown, fallback: string) =>
  typeof value === 'string' && COLOR.test(value) ? value : fallback

// turns anything (e.g. JSON from another player) into a valid avatar
export function sanitizeAvatar(input: unknown): Avatar {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const d = DEFAULT_AVATAR
  return {
    skin: color(raw.skin, d.skin),
    hair: pick(raw.hair, HAIR_STYLES, d.hair),
    hairColor: color(raw.hairColor, d.hairColor),
    top: pick(raw.top, TOP_STYLES, d.top),
    topColor: color(raw.topColor, d.topColor),
    bottom: pick(raw.bottom, BOTTOM_STYLES, d.bottom),
    bottomColor: color(raw.bottomColor, d.bottomColor),
    texture: pick(raw.texture, PRESET_TEXTURES, d.texture),
  }
}

export function parseAvatar(json: string | undefined | null): Avatar | null {
  if (!json) return null
  try {
    return sanitizeAvatar(JSON.parse(json))
  } catch {
    return null
  }
}

// players of the 2D client have no avatar, only a texture in their anim ("lucy_run_left")
export function avatarForTexture(texture: string | undefined): Avatar {
  return PRESETS[texture as PresetTexture] ?? DEFAULT_AVATAR
}

export function randomAvatar(): Avatar {
  const any = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]
  return {
    skin: any(SKIN_COLORS),
    hair: any(HAIR_STYLES),
    hairColor: any(HAIR_COLORS),
    top: any(TOP_STYLES),
    topColor: any(CLOTH_COLORS),
    bottom: any(BOTTOM_STYLES),
    bottomColor: any(CLOTH_COLORS),
    texture: any(PRESET_TEXTURES),
  }
}

const STORAGE_KEY = 'skyoffice3d.avatar'

export function loadAvatar(): Avatar | null {
  try {
    return parseAvatar(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export function saveAvatar(avatar: Avatar) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(avatar))
  } catch {
    // private mode or full storage: the avatar just isn't remembered
  }
}
