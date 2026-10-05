// The VirtualOffice map format: the one source of the office layout for the server, the
// 3D client and the map editor. A map is a JSON file (assets/map/office.json), validated
// by validate.ts and written by serialize.ts. See docs/map-format.md.
//
// Coordinates are in tiles: x to the east (right), y to the south (down), (0, 0) is the top
// left corner of the map. Fractions are allowed. The 3D world uses the same numbers
// (world x = x, world z = y). On the wire (player positions, media zones) the server and
// the clients still use "map pixels": tileSize pixels per tile, with player positions at
// the centre of the old 2D sprite, FEET_OFFSET_PX above the feet.

export const MAP_FORMAT = 'virtualoffice-map'
export const MAP_VERSION = 1
// map pixels per tile; player positions, media distances and zones on the wire use them
export const TILE_SIZE = 32
// a player position on the wire is the centre of the old 2D sprite, 19 px above the feet
export const FEET_OFFSET_PX = 19

export const ZONE_TYPES = ['meeting', 'focus', 'quiet', 'auditorium', 'stage'] as const
export type ZoneType = (typeof ZONE_TYPES)[number]

export const TILE_KINDS = ['void', 'floor', 'wall'] as const
export type TileKind = (typeof TILE_KINDS)[number]

// the direction the front of a placement faces: 0 south (towards the camera), 90 east,
// 180 north, 270 west
export const ROTATIONS = [0, 90, 180, 270] as const
export type Rotation = (typeof ROTATIONS)[number]

export const ASSET_CATEGORIES = [
  'seating',
  'tables',
  'storage',
  'tech',
  'decor',
  'wall',
  'other',
] as const
export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export const ASSET_MOUNTS = ['floor', 'wall'] as const
// floor: stands on the floor in its footprint; wall: hangs on the south face of the wall
// below its footprint (pictures, screens)
export type AssetMount = (typeof ASSET_MOUNTS)[number]

// one entry of the legend of `tiles`
export type TileType = {
  kind: TileKind
  name: string
  // '#rrggbb', floor and wall only
  color?: string
}

export type MapLabel = { id: string; text: string; x: number; y: number }

export type MapZone = {
  id: string
  name: string
  type: ZoneType
  x: number
  y: number
  w: number
  h: number
}

// a local 3D model, relative to the models/ folder the client serves (client-3d/public/models)
export type ModelSource = {
  src: string
  // uniform scale of the model (default 1)
  scale?: number
}

// an asset that the map brings along, e.g. a glTF model; the built-in assets are in catalog.ts
export type MapAsset = {
  id: string
  name: string
  category: AssetCategory
  // default footprint in tiles
  w: number
  h: number
  collides: boolean
  mount?: AssetMount
  model: ModelSource
}

export type Placement = {
  id: string
  // a built-in asset (catalog.ts) or one of the map's `assets`
  asset: string
  // the footprint in tiles; w and h are in map orientation (a rotated table is still w x h)
  x: number
  y: number
  w: number
  h: number
  // default 0
  rotation?: Rotation
  // '#rrggbb' for assets that can be tinted (chairs, pictures, blocks)
  color?: string
  // whether the footprint blocks walking; default: the asset's
  collides?: boolean
  // which cells of the footprint block, one string per row of w characters, '#' solid and
  // '.' free; only for whole-tile footprints. Default: the whole footprint.
  solid?: string[]
}

export type VirtualOfficeMap = {
  format: typeof MAP_FORMAT
  version: typeof MAP_VERSION
  name: string
  tileSize: number
  width: number
  height: number
  // the legend: one character per tile type
  tileTypes: Record<string, TileType>
  // `height` rows of `width` characters of tileTypes
  tiles: string[]
  // where players appear: the feet, in tiles
  spawn: { x: number; y: number }
  // room names shown on the floor
  labels: MapLabel[]
  // media zones (meeting rooms, quiet zones, auditorium and stage)
  zones: MapZone[]
  assets: MapAsset[]
  placements: Placement[]
}

// ---------- coordinates ----------

const round = (value: number) => Math.round(value * 1000) / 1000

// a position in tiles (the feet) as map pixels on the wire
export function tileToWire(x: number, y: number, tileSize = TILE_SIZE) {
  return { x: round(x * tileSize), y: round(y * tileSize - FEET_OFFSET_PX) }
}

// a position on the wire (map pixels) as tiles (the feet)
export function wireToTile(x: number, y: number, tileSize = TILE_SIZE) {
  return { x: x / tileSize, y: (y + FEET_OFFSET_PX) / tileSize }
}

export const rotationToRadians = (rotation: Rotation = 0) => (rotation * Math.PI) / 180

// the footprint of a placement turned by 90 degrees around its centre
export function rotatedFootprint(p: { x: number; y: number; w: number; h: number }) {
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  return { x: cx - p.h / 2, y: cy - p.w / 2, w: p.h, h: p.w }
}

// the 2D direction a chair faces, as the old 2D client named it (part of the sit anim)
export type ChairDirection = 'down' | 'right' | 'up' | 'left'
export const ROTATION_DIRECTION: Record<Rotation, ChairDirection> = {
  0: 'down',
  90: 'right',
  180: 'up',
  270: 'left',
}
