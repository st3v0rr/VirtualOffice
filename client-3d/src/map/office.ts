import data from './office.generated.json'

// The office as extracted from the Tiled map by scripts/extract-map.mjs.
// World units are tiles: world x = map x / 32, world z = map y / 32.

export type TileRect = { x: number; y: number; w: number; h: number }
export type Component = TileRect & {
  color: string
  collides: boolean
  onWall: boolean
  layer: string
}
export type ChairData = {
  id: string
  x: number
  y: number
  dir: 'up' | 'down' | 'left' | 'right'
  color: string
}
export type ItemData = TileRect & { id: string }
export type ZoneData = TileRect & { id: string; name: string; type: string }

export type OfficeData = {
  tileSize: number
  width: number
  height: number
  spawn: { x: number; y: number }
  rows: string[]
  palette: string[]
  floorColors: number[][]
  blockers: TileRect[]
  components: Component[]
  chairs: ChairData[]
  computers: ItemData[]
  whiteboards: ItemData[]
  vendingMachines: ItemData[]
  zones: ZoneData[]
}

export const office = data as OfficeData
export const TILE = office.tileSize

// The Phaser client syncs the centre of its 32x48 sprite; the feet (and the
// collision body) are 19px below that. The 3D client stands on the feet, so it
// converts between the two to stay in the same place for players of both clients.
export const FEET_OFFSET_PX = 19

export const toWorld = (px: number, py: number) => ({
  x: px / TILE,
  z: (py + FEET_OFFSET_PX) / TILE,
})
export const toMap = (x: number, z: number) => ({
  x: Math.round(x * TILE * 10) / 10,
  y: Math.round((z * TILE - FEET_OFFSET_PX) * 10) / 10,
})

export const tileAt = (tx: number, ty: number) => office.rows[ty]?.[tx] ?? '.'

// chairs: 2D direction to the angle the chibi faces (0 = towards +z, the camera)
export const DIR_ANGLE: Record<string, number> = {
  down: 0,
  up: Math.PI,
  left: -Math.PI / 2,
  right: Math.PI / 2,
}

// the seat of a chair in world units; the Phaser sprite centre is the backrest,
// the seat is the lower tile of the 32x64 sprite
export function chairSeat(chair: ChairData) {
  return { x: chair.x / TILE, z: (chair.y + 16) / TILE }
}

// where the Phaser client puts a sitting player (see sittingShiftData in the 2D client)
const SIT_SHIFT: Record<string, [number, number]> = {
  up: [0, 3],
  down: [0, 3],
  left: [0, -8],
  right: [0, -8],
}
export function chairSitPosition(chair: ChairData) {
  const [dx, dy] = SIT_SHIFT[chair.dir] ?? [0, 0]
  return { x: chair.x + dx, y: chair.y + dy }
}

export function zoneAt(x: number, z: number): ZoneData | undefined {
  let found: ZoneData | undefined
  for (const zone of office.zones) {
    if (x >= zone.x && x < zone.x + zone.w && z >= zone.y && z < zone.y + zone.h) {
      if (!found || zone.w * zone.h < found.w * found.h) found = zone
    }
  }
  return found
}

// the z of the wall face a wall-mounted thing belongs to: the first floor row below it
export function wallFaceZ(r: TileRect) {
  const tx = Math.floor(r.x + r.w / 2)
  let row = Math.ceil(r.y + r.h - 0.01)
  while (row < office.height && tileAt(tx, row) !== 'f') row++
  return row
}
