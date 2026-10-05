// The assets a map can place. The built-in ones are the procedural toy furniture of the 3D
// client (rendered by client-3d/src/world/furniture.tsx and items.tsx); a map can register
// more in its `assets` list (local glTF models). Placements may only use assets from here.
import type {
  AssetCategory,
  AssetMount,
  MapAsset,
  ModelSource,
  VirtualOfficeMap,
} from './format.ts'

// what the office does with a placement besides showing it
export type AssetRole = 'chair' | 'computer' | 'vending'

export type AssetInfo = {
  id: string
  // label in the editor
  name: string
  category: AssetCategory
  // shown in the editor's palette
  icon: string
  // default footprint in tiles
  w: number
  h: number
  collides: boolean
  mount: AssetMount
  role?: AssetRole
  // whether the editor lets the footprint be resized
  resizable: boolean
  rotatable: boolean
  // the default tint for assets that use placement.color
  color?: string
  // set for assets of the map (glTF models); built-in assets are procedural
  model?: ModelSource
  builtin: boolean
}

type BuiltinAsset = Omit<AssetInfo, 'builtin' | 'model'>

// keeps the literal ids, so the 3D client can check that it draws every built-in asset
function asset<const T extends BuiltinAsset>(info: T): T & { builtin: true } {
  return { ...info, builtin: true }
}

export const BUILTIN_ASSETS = [
  asset({
    id: 'chair',
    name: 'Stuhl',
    category: 'seating',
    icon: '🪑',
    w: 1,
    h: 1,
    collides: false,
    mount: 'floor',
    role: 'chair',
    resizable: false,
    rotatable: true,
    color: '#cbc3ec',
  }),
  asset({
    id: 'table',
    name: 'Tisch',
    category: 'tables',
    icon: '🟫',
    w: 3,
    h: 2,
    collides: true,
    mount: 'floor',
    resizable: true,
    rotatable: true,
  }),
  asset({
    id: 'desk',
    name: 'Schreibtisch',
    category: 'tables',
    icon: '📝',
    w: 2,
    h: 2,
    collides: true,
    mount: 'floor',
    resizable: true,
    rotatable: true,
  }),
  asset({
    id: 'poolTable',
    name: 'Billardtisch',
    category: 'tables',
    icon: '🎱',
    w: 4,
    h: 3,
    collides: true,
    mount: 'floor',
    resizable: true,
    rotatable: true,
  }),
  asset({
    id: 'bookshelf',
    name: 'Bücherregal',
    category: 'storage',
    icon: '📚',
    w: 3,
    h: 1,
    collides: true,
    mount: 'floor',
    resizable: true,
    rotatable: true,
  }),
  asset({
    id: 'lowShelf',
    name: 'Niedriges Regal',
    category: 'storage',
    icon: '📗',
    w: 2,
    h: 2,
    collides: true,
    mount: 'floor',
    resizable: true,
    rotatable: true,
  }),
  asset({
    id: 'shelf',
    name: 'Regal',
    category: 'storage',
    icon: '🗄️',
    w: 2,
    h: 1,
    collides: true,
    mount: 'floor',
    resizable: true,
    rotatable: true,
  }),
  asset({
    id: 'cabinet',
    name: 'Schrank',
    category: 'storage',
    icon: '🚪',
    w: 2,
    h: 2,
    collides: true,
    mount: 'floor',
    resizable: true,
    rotatable: true,
  }),
  asset({
    id: 'boxes',
    name: 'Kartons',
    category: 'storage',
    icon: '📦',
    w: 3,
    h: 2,
    collides: true,
    mount: 'floor',
    resizable: false,
    rotatable: true,
  }),
  asset({
    id: 'computer',
    name: 'Computer-Arbeitsplatz',
    category: 'tech',
    icon: '💻',
    w: 3,
    h: 2,
    collides: true,
    mount: 'floor',
    role: 'computer',
    resizable: true,
    rotatable: false,
  }),
  asset({
    id: 'vendingMachine',
    name: 'Getränkeautomat',
    category: 'tech',
    icon: '🥤',
    w: 1.5,
    h: 0.75,
    collides: true,
    mount: 'floor',
    role: 'vending',
    resizable: false,
    rotatable: true,
  }),
  asset({
    id: 'printer',
    name: 'Drucker',
    category: 'tech',
    icon: '🖨️',
    w: 2,
    h: 2,
    collides: true,
    mount: 'floor',
    resizable: false,
    rotatable: true,
  }),
  asset({
    id: 'waterCooler',
    name: 'Wasserspender',
    category: 'tech',
    icon: '🚰',
    w: 1,
    h: 1,
    collides: true,
    mount: 'floor',
    resizable: false,
    rotatable: true,
  }),
  asset({
    id: 'plant',
    name: 'Pflanze',
    category: 'decor',
    icon: '🪴',
    w: 1,
    h: 1,
    collides: true,
    mount: 'floor',
    resizable: true,
    rotatable: false,
  }),
  asset({
    id: 'globe',
    name: 'Globus',
    category: 'decor',
    icon: '🌍',
    w: 1,
    h: 1,
    collides: true,
    mount: 'floor',
    resizable: false,
    rotatable: true,
  }),
  asset({
    id: 'block',
    name: 'Block',
    category: 'decor',
    icon: '🧊',
    w: 1,
    h: 1,
    collides: true,
    mount: 'floor',
    resizable: true,
    rotatable: false,
    color: '#d9d2ef',
  }),
  asset({
    id: 'picture',
    name: 'Bild',
    category: 'wall',
    icon: '🖼️',
    w: 2,
    h: 2,
    collides: false,
    mount: 'wall',
    resizable: true,
    rotatable: false,
    color: '#ffd6e0',
  }),
  asset({
    id: 'tv',
    name: 'Bildschirm',
    category: 'wall',
    icon: '📺',
    w: 2,
    h: 2,
    collides: false,
    mount: 'wall',
    resizable: true,
    rotatable: false,
  }),
  asset({
    id: 'blocker',
    name: 'Unsichtbare Sperre',
    category: 'other',
    icon: '🚧',
    w: 1,
    h: 1,
    collides: true,
    mount: 'floor',
    resizable: true,
    rotatable: false,
  }),
] as const satisfies readonly AssetInfo[]

export type BuiltinAssetId = (typeof BUILTIN_ASSETS)[number]['id']

const BUILTIN_BY_ID = new Map<string, AssetInfo>(BUILTIN_ASSETS.map((a) => [a.id, a]))

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  seating: 'Sitzen',
  tables: 'Tische',
  storage: 'Regale & Schränke',
  tech: 'Technik',
  decor: 'Deko',
  wall: 'An der Wand',
  other: 'Sonstiges',
}

export const isBuiltinAsset = (id: string) => BUILTIN_BY_ID.has(id)

export function mapAssetInfo(definition: MapAsset): AssetInfo {
  return {
    id: definition.id,
    name: definition.name,
    category: definition.category,
    icon: '🧩',
    w: definition.w,
    h: definition.h,
    collides: definition.collides,
    mount: definition.mount ?? 'floor',
    resizable: true,
    rotatable: true,
    model: definition.model,
    builtin: false,
  }
}

// the asset a placement refers to: built in, or registered by the map
export function findAsset(
  map: Pick<VirtualOfficeMap, 'assets'>,
  id: string
): AssetInfo | undefined {
  const builtin = BUILTIN_BY_ID.get(id)
  if (builtin) return builtin
  const own = map.assets.find((a) => a.id === id)
  return own && mapAssetInfo(own)
}

// every asset the editor offers for a map
export function assetCatalog(map: Pick<VirtualOfficeMap, 'assets'>): AssetInfo[] {
  return [...BUILTIN_ASSETS, ...map.assets.map(mapAssetInfo)]
}

// whether a placement blocks walking (its own setting, else the asset's)
export function placementCollides(placement: { collides?: boolean }, info: AssetInfo | undefined) {
  return placement.collides ?? info?.collides ?? false
}
