import { findAsset, placementCollides, type AssetInfo } from '../../../types/map/catalog'
import {
  ROTATION_DIRECTION,
  tileToWire,
  type ChairDirection,
  type Placement,
  type Rotation,
  type VirtualOfficeMap,
  type ZoneType,
} from '../../../types/map/format'
import { zonesInPixels, type Zone } from '../../../types/OfficeMap'

// A map (see types/map/format.ts) turned into what the 3D client needs: the tile codes for
// walls and collision, the collision rectangles, the furniture to draw and the usable
// things. World units are tiles: world x = map x, world z = map y.

export type TileRect = { x: number; y: number; w: number; h: number }

export type ChairData = {
  id: string
  // the centre of the seat
  x: number
  z: number
  // the angle a sitting chibi faces (0 = towards +z, the camera)
  rot: number
  dir: ChairDirection
  color: string
}

export type ItemData = TileRect & { id: string; rotation: Rotation }

export type FurnitureData = TileRect & {
  id: string
  asset: AssetInfo
  rotation: Rotation
  color?: string
  collides: boolean
  // the blocking parts of a footprint with a collision mask, in tiles; null = all of it
  solid: TileRect[] | null
}

export type ZoneData = TileRect & { id: string; name: string; type: ZoneType }
export type LabelData = { id: string; text: string; x: number; z: number }

export type OfficeData = {
  map: VirtualOfficeMap
  tileSize: number
  width: number
  height: number
  // where players appear: the feet in the world, and the position on the wire
  spawn: { x: number; z: number }
  spawnPx: { x: number; y: number }
  // per row one character per tile: '.' void, 'f' floor, '#' wall
  rows: string[]
  // the colour of every tile, '' for void
  colors: string[][]
  // what blocks walking besides walls and void
  blockers: TileRect[]
  furniture: FurnitureData[]
  chairs: ChairData[]
  computers: ItemData[]
  vendingMachines: ItemData[]
  zones: ZoneData[]
  // the zones in map pixels, as the server and the media rules use them
  zonesPx: Zone[]
  labels: LabelData[]
}

const CODES = { void: '.', floor: 'f', wall: '#' } as const

// the angle a chibi faces for a rotation, between -PI and PI like the 2D directions were
export function facingAngle(rotation: Rotation = 0) {
  return rotation === 270 ? -Math.PI / 2 : (rotation * Math.PI) / 180
}

// the '#' cells of a collision mask merged into as few rectangles as possible
export function solidRects(p: Pick<Placement, 'x' | 'y' | 'solid'>): TileRect[] {
  const mask = p.solid ?? []
  const free = mask.map((row) => [...row].map((cell) => cell === '#'))
  const rects: TileRect[] = []
  for (let y = 0; y < free.length; y++)
    for (let x = 0; x < free[y].length; x++) {
      if (!free[y][x]) continue
      let w = 1
      while (x + w < free[y].length && free[y][x + w]) w++
      let h = 1
      while (y + h < free.length && free[y + h].slice(x, x + w).every(Boolean)) h++
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) free[yy][xx] = false
      rects.push({ x: p.x + x, y: p.y + y, w, h })
    }
  return rects
}

export function compileOffice(map: VirtualOfficeMap): OfficeData {
  const rows = map.tiles.map((row) =>
    [...row].map((char) => CODES[map.tileTypes[char]?.kind ?? 'void']).join('')
  )
  const colors = map.tiles.map((row) => [...row].map((char) => map.tileTypes[char]?.color ?? ''))

  const blockers: TileRect[] = []
  const furniture: FurnitureData[] = []
  const chairs: ChairData[] = []
  const computers: ItemData[] = []
  const vendingMachines: ItemData[] = []
  for (const p of map.placements) {
    const asset = findAsset(map, p.asset)
    if (!asset) continue
    const rect = { x: p.x, y: p.y, w: p.w, h: p.h }
    const rotation = p.rotation ?? 0
    const collides = placementCollides(p, asset)
    const solid = collides && p.solid ? solidRects(p) : null
    if (collides) blockers.push(...(solid ?? [rect]))
    switch (asset.role) {
      case 'chair':
        chairs.push({
          id: p.id,
          x: p.x + p.w / 2,
          z: p.y + p.h / 2,
          rot: facingAngle(rotation),
          dir: ROTATION_DIRECTION[rotation],
          color: p.color ?? asset.color ?? '#cbc3ec',
        })
        break
      case 'computer':
        computers.push({ id: p.id, ...rect, rotation })
        break
      case 'vending':
        vendingMachines.push({ id: p.id, ...rect, rotation })
        break
      default:
        furniture.push({ id: p.id, ...rect, asset, rotation, color: p.color, collides, solid })
    }
  }

  return {
    map,
    tileSize: map.tileSize,
    width: map.width,
    height: map.height,
    spawn: { x: map.spawn.x, z: map.spawn.y },
    spawnPx: tileToWire(map.spawn.x, map.spawn.y, map.tileSize),
    rows,
    colors,
    blockers,
    furniture,
    chairs,
    computers,
    vendingMachines,
    zones: map.zones.map((z) => ({ ...z })),
    zonesPx: zonesInPixels(map),
    labels: map.labels.map((l) => ({ id: l.id, text: l.text, x: l.x, z: l.y })),
  }
}
