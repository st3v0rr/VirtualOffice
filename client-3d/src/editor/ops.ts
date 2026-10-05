import { findAsset } from '../../../types/map/catalog'
import {
  MAP_FORMAT,
  MAP_VERSION,
  TILE_SIZE,
  type MapLabel,
  type MapZone,
  type Placement,
  type Rotation,
  type TileKind,
  type TileType,
  type VirtualOfficeMap,
  type ZoneType,
} from '../../../types/map/format'
import { MAP_LIMITS } from '../../../types/map/validate'

// The editing operations of the map editor: pure functions from a map to a new map, so
// they are easy to test and every step can be undone. Coordinates are in tiles.

export type Rect = { x: number; y: number; w: number; h: number }
export type Cell = { x: number; y: number }

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
// no 0.30000000000000004 in the map file
const tidy = (value: number) => Math.round(value * 1e6) / 1e6
export const snap = (value: number, step = 1) => tidy(Math.round(value / step) * step)

// `<prefix>-<n>` with the smallest n not taken yet
export function nextId(prefix: string, taken: Iterable<string>) {
  const used = new Set(taken)
  for (let n = 1; ; n++) if (!used.has(`${prefix}-${n}`)) return `${prefix}-${n}`
}

// a rectangle moved (not shrunk) into the map; only cut when it is bigger than the map
export function clampRect(map: Pick<VirtualOfficeMap, 'width' | 'height'>, r: Rect): Rect {
  const w = Math.min(r.w, map.width)
  const h = Math.min(r.h, map.height)
  return { x: tidy(clamp(r.x, 0, map.width - w)), y: tidy(clamp(r.y, 0, map.height - h)), w, h }
}

// the rectangle between two points, e.g. of a drag, in whole tiles (at least one)
export function cellRect(a: Cell, b: Cell): Rect {
  const x0 = Math.floor(Math.min(a.x, b.x))
  const y0 = Math.floor(Math.min(a.y, b.y))
  const x1 = Math.floor(Math.max(a.x, b.x)) + 1
  const y1 = Math.floor(Math.max(a.y, b.y)) + 1
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export const rectCells = (r: Rect): Cell[] => {
  const cells: Cell[] = []
  for (let y = Math.floor(r.y); y < Math.ceil(r.y + r.h); y++)
    for (let x = Math.floor(r.x); x < Math.ceil(r.x + r.w); x++) cells.push({ x, y })
  return cells
}

export const tileKindAt = (map: VirtualOfficeMap, x: number, y: number): TileKind | undefined =>
  map.tileTypes[map.tiles[Math.floor(y)]?.[Math.floor(x)]]?.kind

// ---------- tiles ----------

// paint cells with a tile type
export function setTiles(map: VirtualOfficeMap, cells: Cell[], key: string): VirtualOfficeMap {
  if (!Object.hasOwn(map.tileTypes, key)) throw new Error(`Unknown tile type "${key}"`)
  const rows = new Map<number, string[]>()
  for (const { x, y } of cells) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue
    if (map.tiles[y][x] === key) continue
    let row = rows.get(y)
    if (!row) rows.set(y, (row = [...map.tiles[y]]))
    row[x] = key
  }
  if (!rows.size) return map
  return { ...map, tiles: map.tiles.map((row, y) => rows.get(y)?.join('') ?? row) }
}

export const fillRect = (map: VirtualOfficeMap, r: Rect, key: string) =>
  setTiles(map, rectCells(r), key)

// a room: walls around, floor inside
export function drawRoom(map: VirtualOfficeMap, r: Rect, floor: string, wall: string) {
  const cells = rectCells(r)
  const border = (c: Cell) =>
    c.x === r.x || c.y === r.y || c.x === r.x + r.w - 1 || c.y === r.y + r.h - 1
  const withWalls = setTiles(map, cells.filter(border), wall)
  return setTiles(
    withWalls,
    cells.filter((c) => !border(c)),
    floor
  )
}

// the first tile type of a kind, e.g. the wall for the room tool
export const firstTileOfKind = (map: VirtualOfficeMap, kind: TileKind) =>
  Object.keys(map.tileTypes).find((key) => map.tileTypes[key].kind === kind)

// characters for new tile types, in this order
const TILE_KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+*=%&$@!?~^<>'

export function addTileType(map: VirtualOfficeMap, type: TileType) {
  const key = [...TILE_KEYS].find((k) => !Object.hasOwn(map.tileTypes, k))
  if (!key || Object.keys(map.tileTypes).length >= MAP_LIMITS.maxTileTypes)
    throw new Error('No more tile types possible')
  return { map: { ...map, tileTypes: { ...map.tileTypes, [key]: type } }, key }
}

export function updateTileType(map: VirtualOfficeMap, key: string, patch: Partial<TileType>) {
  const type = { ...map.tileTypes[key], ...patch }
  if (type.kind === 'void') delete type.color
  return { ...map, tileTypes: { ...map.tileTypes, [key]: type } }
}

export const tileTypeUsed = (map: VirtualOfficeMap, key: string) =>
  map.tiles.some((row) => row.includes(key))

// only types that no tile uses can go
export function removeTileType(map: VirtualOfficeMap, key: string) {
  if (tileTypeUsed(map, key)) return map
  const tileTypes = { ...map.tileTypes }
  delete tileTypes[key]
  return { ...map, tileTypes }
}

// ---------- placements ----------

const placementIds = (map: VirtualOfficeMap) => map.placements.map((p) => p.id)

export const findPlacement = (map: VirtualOfficeMap, id: string) =>
  map.placements.find((p) => p.id === id)

// a new placement of an asset, its footprint centred on (cx, cy) and snapped to the grid
export function placeAsset(map: VirtualOfficeMap, asset: string, cx: number, cy: number, step = 1) {
  const info = findAsset(map, asset)
  if (!info) throw new Error(`Unknown asset "${asset}"`)
  const rect = clampRect(map, {
    x: snap(cx - info.w / 2, step),
    y: snap(cy - info.h / 2, step),
    w: info.w,
    h: info.h,
  })
  const id = nextId(asset, placementIds(map))
  const placement: Placement = { id, asset, ...rect }
  return { map: { ...map, placements: [...map.placements, placement] }, id }
}

export function updatePlacement(map: VirtualOfficeMap, id: string, patch: Partial<Placement>) {
  return {
    ...map,
    placements: map.placements.map((p) => {
      if (p.id !== id) return p
      const next = { ...p, ...patch }
      for (const key of Object.keys(next) as (keyof Placement)[])
        if (next[key] === undefined) delete next[key]
      return next
    }),
  }
}

export function movePlacement(map: VirtualOfficeMap, id: string, x: number, y: number) {
  const p = findPlacement(map, id)
  if (!p) return map
  const rect = clampRect(map, { x, y, w: p.w, h: p.h })
  if (rect.x === p.x && rect.y === p.y) return map
  return updatePlacement(map, id, { x: rect.x, y: rect.y })
}

// a new size; a collision mask doesn't fit any more and is dropped (the whole footprint blocks)
export function resizePlacement(map: VirtualOfficeMap, id: string, w: number, h: number) {
  const p = findPlacement(map, id)
  if (!p) return map
  const size = (v: number) => tidy(clamp(v, 0.25, MAP_LIMITS.maxFootprint))
  const rect = clampRect(map, { x: p.x, y: p.y, w: size(w), h: size(h) })
  if (rect.w === p.w && rect.h === p.h && rect.x === p.x && rect.y === p.y) return map
  return updatePlacement(map, id, { ...rect, solid: undefined })
}

// a collision mask turned like its placement: +90 degrees turns the map view counter-clockwise
export function rotateMask(mask: string[], turns: number) {
  let rows = mask
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    const h = rows.length
    const w = rows[0]?.length ?? 0
    rows = Array.from({ length: w }, (_, r) =>
      Array.from({ length: h }, (_, c) => rows[c][w - 1 - r]).join('')
    )
  }
  return rows
}

// turn by 90 degrees (turns = -1: the other way) around the centre of the footprint
export function rotatePlacement(map: VirtualOfficeMap, id: string, turns = 1) {
  const p = findPlacement(map, id)
  const info = p && findAsset(map, p.asset)
  if (!p || !info?.rotatable) return map
  const rotation = ((((p.rotation ?? 0) + turns * 90) % 360) + 360) % 360
  if (turns % 2 === 0) return updatePlacement(map, id, { rotation: rotation as Rotation })
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  // footprints on the grid stay on the grid; a footprint like 3 x 2 can't keep its centre
  // exactly, so it goes down when turned and up when upright: turning back restores it
  const aligned = Number.isInteger(p.x) && Number.isInteger(p.y)
  const turned = rotation === 90 || rotation === 270
  const at = (v: number) => (aligned ? (turned ? Math.floor(v) : Math.ceil(v)) : tidy(v))
  const rect = clampRect(map, { x: at(cx - p.h / 2), y: at(cy - p.w / 2), w: p.h, h: p.w })
  return updatePlacement(map, id, {
    ...rect,
    rotation: rotation as Rotation,
    solid: p.solid && rotateMask(p.solid, turns),
  })
}

export function deletePlacement(map: VirtualOfficeMap, id: string) {
  return { ...map, placements: map.placements.filter((p) => p.id !== id) }
}

// a copy one tile to the right and down
export function duplicatePlacement(map: VirtualOfficeMap, id: string) {
  const p = findPlacement(map, id)
  if (!p) return { map, id }
  const copyId = nextId(p.asset, placementIds(map))
  const rect = clampRect(map, { x: p.x + 1, y: p.y + 1, w: p.w, h: p.h })
  const copy: Placement = { ...p, ...rect, id: copyId, solid: p.solid && [...p.solid] }
  if (!copy.solid) delete copy.solid
  return { map: { ...map, placements: [...map.placements, copy] }, id: copyId }
}

// whether a placement's collision can be set per tile: whole tiles, not too many
export const canMask = (p: Placement) =>
  Number.isInteger(p.w) &&
  Number.isInteger(p.h) &&
  p.w <= MAP_LIMITS.maxSolid &&
  p.h <= MAP_LIMITS.maxSolid

// block or free one tile of the footprint; a mask with every tile blocked is no mask
export function setSolidCell(
  map: VirtualOfficeMap,
  id: string,
  cx: number,
  cy: number,
  solid: boolean
) {
  const p = findPlacement(map, id)
  if (!p || !canMask(p) || cx < 0 || cy < 0 || cx >= p.w || cy >= p.h) return map
  const mask = (p.solid ?? Array.from({ length: p.h }, () => '#'.repeat(p.w))).map((row, y) =>
    y === cy ? row.slice(0, cx) + (solid ? '#' : '.') + row.slice(cx + 1) : row
  )
  const full = mask.every((row) => !row.includes('.'))
  return updatePlacement(map, id, { solid: full ? undefined : mask })
}

// ---------- spawn, zones, labels ----------

export function setSpawn(map: VirtualOfficeMap, x: number, y: number) {
  const spawn = {
    x: tidy(clamp(x, 0, map.width - 0.001)),
    y: tidy(clamp(y, 0, map.height - 0.001)),
  }
  return { ...map, spawn }
}

export function addZone(map: VirtualOfficeMap, r: Rect, type: ZoneType = 'meeting') {
  const id = nextId(
    'zone',
    map.zones.map((z) => z.id)
  )
  const zone: MapZone = { id, name: 'Neue Zone', type, ...clampRect(map, r) }
  return { map: { ...map, zones: [...map.zones, zone] }, id }
}

export function updateZone(map: VirtualOfficeMap, id: string, patch: Partial<MapZone>) {
  return {
    ...map,
    zones: map.zones.map((z) => {
      if (z.id !== id) return z
      const next = { ...z, ...patch }
      const size = (v: number) => tidy(Math.max(v, 0.25))
      return { ...next, ...clampRect(map, { ...next, w: size(next.w), h: size(next.h) }) }
    }),
  }
}

export const deleteZone = (map: VirtualOfficeMap, id: string) => ({
  ...map,
  zones: map.zones.filter((z) => z.id !== id),
})

const insideMap = (map: VirtualOfficeMap, x: number, y: number) => ({
  x: tidy(clamp(x, 0, map.width)),
  y: tidy(clamp(y, 0, map.height)),
})

export function addLabel(map: VirtualOfficeMap, x: number, y: number, text = 'Raum') {
  const id = nextId(
    'label',
    map.labels.map((l) => l.id)
  )
  const label: MapLabel = { id, text, ...insideMap(map, x, y) }
  return { map: { ...map, labels: [...map.labels, label] }, id }
}

export function updateLabel(map: VirtualOfficeMap, id: string, patch: Partial<MapLabel>) {
  return {
    ...map,
    labels: map.labels.map((l) => {
      if (l.id !== id) return l
      const next = { ...l, ...patch }
      return { ...next, ...insideMap(map, next.x, next.y) }
    }),
  }
}

export const deleteLabel = (map: VirtualOfficeMap, id: string) => ({
  ...map,
  labels: map.labels.filter((l) => l.id !== id),
})

// ---------- the whole map ----------

const within = (map: Pick<VirtualOfficeMap, 'width' | 'height'>, r: Rect) =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= map.width && r.y + r.h <= map.height

// a new size, growing or cutting at the right and bottom; what doesn't fit any more is removed
export function resizeMap(map: VirtualOfficeMap, width: number, height: number) {
  const w = clamp(Math.round(width), 1, MAP_LIMITS.maxSize)
  const h = clamp(Math.round(height), 1, MAP_LIMITS.maxSize)
  let next = map
  let empty = firstTileOfKind(map, 'void')
  if (!empty) ({ map: next, key: empty } = addTileType(map, { kind: 'void', name: 'Leer' }))
  const tiles = Array.from({ length: h }, (_, y) =>
    (map.tiles[y] ?? '').slice(0, w).padEnd(w, empty)
  )
  const size = { width: w, height: h }
  const placements = map.placements.filter((p) => within(size, p))
  const zones = map.zones.filter((z) => within(size, z))
  const labels = map.labels.filter((l) => l.x <= w && l.y <= h)
  const removed =
    map.placements.length -
    placements.length +
    (map.zones.length - zones.length) +
    (map.labels.length - labels.length)
  next = { ...next, width: w, height: h, tiles, placements, zones, labels }
  return { map: setSpawn(next, map.spawn.x, map.spawn.y), removed }
}

// an empty map: one room with walls around
export function createMap(width = 24, height = 16): VirtualOfficeMap {
  const map: VirtualOfficeMap = {
    format: MAP_FORMAT,
    version: MAP_VERSION,
    name: 'Neues Büro',
    tileSize: TILE_SIZE,
    width,
    height,
    tileTypes: {
      '.': { kind: 'void', name: 'Leer' },
      '#': { kind: 'wall', name: 'Wand', color: '#efe8f5' },
      g: { kind: 'floor', name: 'Boden', color: '#eeeae4' },
    },
    tiles: Array.from({ length: height }, () => '.'.repeat(width)),
    spawn: { x: width / 2, y: height / 2 },
    labels: [],
    zones: [],
    assets: [],
    placements: [],
  }
  return drawRoom(map, { x: 1, y: 1, w: width - 2, h: height - 2 }, 'g', '#')
}
