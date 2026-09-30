// Converts the Tiled map of the office into the data the 3D diorama needs.
//
//   npm run extract-map -w client-3d
//
// Input:  assets/map/map.json (+ the tileset PNGs it references, assets/map/tilesets/)
// Output: client-3d/src/map/office.generated.json
//
// The Tiled map stays the single source of truth for the client and the server:
// - walkability/collision is taken from the rules of the original Phaser client
//   (tiles with a `collides` property, object layers with `collides` or the legacy
//   *OnCollide/Basement layers, the vending machine)
// - every decoration object is grouped with its neighbours into a "component" with a
//   bounding box and the average colour of its pixels, which the 3D client turns into a
//   toon prefab (see src/map/furniture.ts) or, as fallback, a rounded box
// - floor and wall colours are the averaged pixel colours of their tiles
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const root = path.resolve(import.meta.dirname, '..', '..')
const mapFile = path.join(root, 'assets', 'map', 'map.json')
const outFile = path.join(root, 'client-3d', 'src', 'map', 'office.generated.json')

const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
const TILE = map.tilewidth
const W = map.width
const H = map.height

// Whiteboard: the map still has the whiteboard objects of the old 2D client, but the 3D client
// has no whiteboards (planned as an external service), so they are ignored like a special layer
const SPECIAL_LAYERS = new Set([
  'Chair',
  'Computer',
  'Whiteboard',
  'VendingMachine',
  'Spawn',
  'Zones',
])
const LEGACY_COLLIDING_LAYERS = new Set(['ObjectsOnCollide', 'GenericObjectsOnCollide', 'Basement'])

const prop = (obj, name) => {
  const p = obj.properties
  if (Array.isArray(p)) return p.find((x) => x.name === name)?.value
  return p?.[name]
}

// ---------- tilesets & pixels ----------

const images = new Map()
function tilesetImage(ts) {
  if (!images.has(ts.name)) {
    const file = path.join(path.dirname(mapFile), ts.image)
    if (!fs.existsSync(file)) throw new Error(`Tileset image for ${ts.name} not found: ${file}`)
    images.set(ts.name, PNG.sync.read(fs.readFileSync(file)))
  }
  return images.get(ts.name)
}

function tilesetFor(gid) {
  let found = map.tilesets[0]
  for (const ts of map.tilesets) if (ts.firstgid <= gid) found = ts
  return found
}

// sum of rgb of the opaque pixels of a tile / object sprite
function spritePixels(gid) {
  const ts = tilesetFor(gid)
  const img = tilesetImage(ts)
  const index = gid - ts.firstgid
  const cols = ts.columns || Math.floor(img.width / ts.tilewidth)
  const sx = (index % cols) * ts.tilewidth
  const sy = Math.floor(index / cols) * ts.tileheight
  const acc = { r: 0, g: 0, b: 0, n: 0 }
  for (let y = 0; y < ts.tileheight; y++) {
    for (let x = 0; x < ts.tilewidth; x++) {
      const i = ((sy + y) * img.width + sx + x) * 4
      if (img.data[i + 3] < 128) continue
      acc.r += img.data[i]
      acc.g += img.data[i + 1]
      acc.b += img.data[i + 2]
      acc.n++
    }
  }
  return acc
}

const hex = ({ r, g, b, n }) => {
  if (!n) return '#cccccc'
  const c = (v) =>
    Math.round(v / n)
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

const collidingTileIds = new Map() // tileset name -> Set of local ids
for (const ts of map.tilesets) {
  const ids = new Set()
  for (const tile of ts.tiles ?? []) if (prop(tile, 'collides')) ids.add(tile.id)
  collidingTileIds.set(ts.name, ids)
}
const tileCollides = (gid) => {
  const ts = tilesetFor(gid)
  return collidingTileIds.get(ts.name)?.has(gid - ts.firstgid) ?? false
}

// ---------- tile grid ----------

// 0 = empty, 1 = walkable tile, 2 = colliding tile (wall)
const grid = new Array(W * H).fill(0)
const tileColor = new Array(W * H).fill(null)
for (const layer of map.layers) {
  if (layer.type !== 'tilelayer') continue
  layer.data.forEach((gid, i) => {
    if (!gid) return
    if (tileCollides(gid)) grid[i] = 2
    else if (grid[i] === 0) grid[i] = 1
    // the upper layer wins for the colour, like it does visually
    tileColor[i] = hex(spritePixels(gid))
  })
}

// ---------- objects ----------

const objectLayers = map.layers.filter((l) => l.type === 'objectgroup')
const objectsOf = (name) => objectLayers.find((l) => l.name === name)?.objects ?? []

// Tiled anchors tile objects at their bottom left corner
const rectOf = (o) => ({ x: o.x, y: o.y - o.height, w: o.width, h: o.height })

const blockers = [] // collision rects in px
const decoration = [] // { rect, collides, color acc }
for (const layer of objectLayers) {
  if (SPECIAL_LAYERS.has(layer.name)) continue
  const collides = prop(layer, 'collides') ?? LEGACY_COLLIDING_LAYERS.has(layer.name)
  for (const o of layer.objects) {
    if (!o.gid) continue
    const rect = rectOf(o)
    if (collides) blockers.push(rect)
    decoration.push({ rect, collides, pixels: spritePixels(o.gid), layer: layer.name })
  }
}
for (const o of objectsOf('VendingMachine')) blockers.push(rectOf(o))

// ---------- walkable area: flood fill from the spawn ----------

const spawnObj = objectsOf('Spawn')[0]
const spawn = spawnObj ? { x: spawnObj.x, y: spawnObj.y } : { x: 705, y: 500 }

// a tile is blocked if a wall tile or (mostly) a blocker covers it
const blockedTile = new Array(W * H).fill(false)
for (let i = 0; i < W * H; i++) if (grid[i] === 2) blockedTile[i] = true
const reachable = new Array(W * H).fill(false)
{
  const queue = [Math.floor(spawn.y / TILE) * W + Math.floor(spawn.x / TILE)]
  reachable[queue[0]] = true
  while (queue.length) {
    const i = queue.pop()
    const x = i % W
    const y = Math.floor(i / W)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const j = ny * W + nx
      if (reachable[j] || blockedTile[j]) continue
      reachable[j] = true
      queue.push(j)
    }
  }
}

// tile codes for the client: '.' void, 'f' floor, '#' wall next to the office
const rows = []
const floorColors = []
const palette = []
const paletteIndex = (c) => {
  let i = palette.indexOf(c)
  if (i < 0) i = palette.push(c) - 1
  return i
}
const isRoomTile = (x, y) => x >= 0 && y >= 0 && x < W && y < H && reachable[y * W + x]
for (let y = 0; y < H; y++) {
  let row = ''
  const colors = []
  for (let x = 0; x < W; x++) {
    const i = y * W + x
    let code = '.'
    if (reachable[i]) code = 'f'
    else if (grid[i] === 2) {
      // only walls that border the office, the rest of the tile layer is backdrop
      let near = false
      for (let dy = -2; dy <= 2 && !near; dy++)
        for (let dx = -1; dx <= 1 && !near; dx++) near = isRoomTile(x + dx, y + dy)
      if (near) code = '#'
    }
    row += code
    colors.push(code === '.' ? -1 : paletteIndex(tileColor[i] ?? '#dddddd'))
  }
  rows.push(row)
  floorColors.push(colors)
}

// ---------- decoration components ----------

// union-find over decoration rects of the same layer that overlap or touch
const parent = decoration.map((_, i) => i)
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
const touches = (a, b) =>
  a.x <= b.x + b.w &&
  b.x <= a.x + a.w &&
  a.y <= b.y + b.h &&
  b.y <= a.y + a.h &&
  // corners only touching don't count
  !((a.x + a.w === b.x || b.x + b.w === a.x) && (a.y + a.h === b.y || b.y + b.h === a.y))
for (let i = 0; i < decoration.length; i++)
  for (let j = i + 1; j < decoration.length; j++)
    if (
      decoration[i].layer === decoration[j].layer &&
      touches(decoration[i].rect, decoration[j].rect)
    )
      parent[find(i)] = find(j)

const groups = new Map()
decoration.forEach((d, i) => {
  const r = find(i)
  if (!groups.has(r)) groups.set(r, [])
  groups.get(r).push(d)
})

const components = []
for (const members of groups.values()) {
  const x0 = Math.min(...members.map((m) => m.rect.x))
  const y0 = Math.min(...members.map((m) => m.rect.y))
  const x1 = Math.max(...members.map((m) => m.rect.x + m.rect.w))
  const y1 = Math.max(...members.map((m) => m.rect.y + m.rect.h))
  const acc = { r: 0, g: 0, b: 0, n: 0 }
  for (const m of members) for (const k of 'rgbn') acc[k] += m.pixels[k]
  // on the wall = most of its tiles are not walkable (pictures, TVs, windows)
  let wallTiles = 0
  let tiles = 0
  for (let ty = y0 / TILE; ty < y1 / TILE; ty++)
    for (let tx = x0 / TILE; tx < x1 / TILE; tx++) {
      tiles++
      if (!isRoomTile(tx, ty)) wallTiles++
    }
  components.push({
    x: x0 / TILE,
    y: y0 / TILE,
    w: (x1 - x0) / TILE,
    h: (y1 - y0) / TILE,
    color: hex(acc),
    collides: members.some((m) => m.collides),
    onWall: wallTiles / tiles > 0.5,
    layer: members[0].layer,
  })
}
components.sort((a, b) => a.y - b.y || a.x - b.x)

// ---------- items ----------

const chairs = objectsOf('Chair').map((o) => ({
  id: String(o.id),
  // same position as the Phaser sprite centre
  x: o.x + o.width / 2,
  y: o.y - o.height / 2,
  dir: prop(o, 'direction') ?? 'down',
  color: hex(spritePixels(o.gid)),
}))
const itemRect = (o) => {
  const r = rectOf(o)
  return { id: String(o.id), x: r.x / TILE, y: r.y / TILE, w: r.w / TILE, h: r.h / TILE }
}

const zones = objectsOf('Zones').map((o) => ({
  id: String(o.id),
  name: o.name,
  type: o.class || o.type || prop(o, 'type'),
  x: o.x / TILE,
  y: o.y / TILE,
  w: o.width / TILE,
  h: o.height / TILE,
}))

const out = {
  source: 'assets/map/map.json',
  tileSize: TILE,
  width: W,
  height: H,
  spawn,
  rows,
  palette,
  floorColors,
  blockers: blockers.map((r) => ({ x: r.x / TILE, y: r.y / TILE, w: r.w / TILE, h: r.h / TILE })),
  components,
  chairs,
  computers: objectsOf('Computer').map(itemRect),
  vendingMachines: objectsOf('VendingMachine').map(itemRect),
  zones,
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(out))
console.log(
  `wrote ${path.relative(root, outFile)}: ${rows.join('').split('f').length - 1} floor tiles, ` +
    `${blockers.length} blockers, ${components.length} components, ${chairs.length} chairs`
)
