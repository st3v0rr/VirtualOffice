import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PNG } from 'pngjs'
// @ts-expect-error plain JavaScript without types
import { extractOffice, floodFill } from '../scripts/lib/extract.mjs'
import { parseOfficeMap } from '../../types/OfficeMap'
import { zones as clientZones } from '../src/map/zones'
import generated from '../src/map/office.generated.json'

const mapUrl = new URL('../../assets/map/map.json', import.meta.url)
const readJson = (url: URL) => JSON.parse(readFileSync(url, 'utf8'))

describe('floodFill', () => {
  // 0 free, 1 blocked
  const grid = (rows: string[]) =>
    rows
      .join('')
      .split('')
      .map((c) => c === '#')
  const show = (reachable: boolean[], w: number) =>
    reachable
      .map((r) => (r ? 'o' : '.'))
      .join('')
      .match(new RegExp(`.{${w}}`, 'g'))

  it('fills the room of the start tile, not the room behind the wall', () => {
    const blocked = grid(['#####', '#..##', '#..#.', '#####'])
    expect(show(floodFill(blocked, 5, 4, 1, 1), 5)).toEqual(['.....', '.oo..', '.oo..', '.....'])
  })

  it('does not leak through diagonal gaps', () => {
    const blocked = grid(['.#', '#.'])
    expect(show(floodFill(blocked, 2, 2, 0, 0), 2)).toEqual(['o.', '..'])
  })

  it('goes through doors (a single free tile in a wall)', () => {
    const blocked = grid(['..#..', '.....', '..#..'])
    expect(floodFill(blocked, 5, 3, 0, 0).every((r: boolean, i: number) => r === !blocked[i])).toBe(
      true
    )
  })

  it('reaches nothing from a blocked or outside start', () => {
    expect(floodFill([true, false], 2, 1, 0, 0)).toEqual([false, false])
    expect(floodFill([false, false], 2, 1, 5, 0)).toEqual([false, false])
  })
})

// a tiny map: two floor rooms split by a wall, the spawn in the left one
function tinyMap() {
  const F = 1 // floor tile
  const W = 2 // wall tile, `collides`
  return {
    tilewidth: 32,
    width: 6,
    height: 5,
    tilesets: [
      {
        firstgid: 1,
        name: 'tiles',
        image: 'tiles.png',
        tilewidth: 32,
        tileheight: 32,
        columns: 2,
        tiles: [{ id: 1, properties: [{ name: 'collides', value: true }] }],
      },
    ],
    layers: [
      {
        name: 'Ground',
        type: 'tilelayer',
        data: [
          ...[W, W, W, W, W, W],
          ...[W, F, F, W, F, W],
          ...[W, F, F, W, F, W],
          ...[W, F, F, W, F, W],
          ...[W, W, W, W, W, W],
        ],
      },
      { name: 'Spawn', type: 'objectgroup', objects: [{ id: 1, x: 48, y: 48 }] },
      {
        name: 'Objects',
        type: 'objectgroup',
        properties: [{ name: 'collides', value: true }],
        // Tiled anchors tile objects at the bottom left
        objects: [{ id: 2, gid: 1, x: 32, y: 96, width: 32, height: 32 }],
      },
      {
        name: 'Chair',
        type: 'objectgroup',
        objects: [
          {
            id: 3,
            gid: 1,
            x: 64,
            y: 96,
            width: 32,
            height: 64,
            properties: [{ name: 'direction', value: 'up' }],
          },
        ],
      },
      {
        name: 'Computer',
        type: 'objectgroup',
        objects: [{ id: 5, gid: 1, x: 32, y: 64, width: 32, height: 32 }],
      },
      {
        name: 'Whiteboard',
        type: 'objectgroup',
        objects: [{ id: 6, gid: 1, x: 64, y: 64, width: 64, height: 64 }],
      },
      {
        name: 'Zones',
        type: 'objectgroup',
        objects: [{ id: 9, name: 'Quiet', type: 'quiet', x: 32, y: 32, width: 64, height: 64 }],
      },
    ],
  }
}

// tile 0 orange, tile 1 dark blue
function tinyTileset() {
  const width = 64
  const height = 32
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data.set(x < 32 ? [200, 100, 50, 255] : [10, 20, 30, 255], i)
    }
  return { width, height, data }
}

describe('extractOffice', () => {
  const office = extractOffice(tinyMap(), () => tinyTileset(), 'tiny.json')

  it('marks the reachable room as floor and only the walls around it', () => {
    expect(office.rows).toEqual(['####..', '#ff#..', '#ff#..', '#ff#..', '####..'])
    expect(office.spawn).toEqual({ x: 48, y: 48 })
  })

  it('colours floor and walls with the average colour of their tiles', () => {
    const color = (x: number, y: number) => office.palette[office.floorColors[y][x]]
    expect(color(1, 1)).toBe('#c86432')
    expect(color(0, 0)).toBe('#0a141e')
    expect(office.floorColors[1][4]).toBe(-1)
  })

  it('turns objects of colliding layers into blockers, in tiles', () => {
    expect(office.blockers).toEqual([{ x: 1, y: 2, w: 1, h: 1 }])
    expect(office.components).toMatchObject([
      { x: 1, y: 2, w: 1, h: 1, collides: true, layer: 'Objects', color: '#c86432' },
    ])
  })

  it('reads chairs, computers and zones and ignores the whiteboards', () => {
    expect(office.chairs).toEqual([{ id: '3', x: 80, y: 64, dir: 'up', color: '#c86432' }])
    expect(office.computers).toEqual([{ id: '5', x: 1, y: 1, w: 1, h: 1 }])
    expect(office.zones).toEqual([
      { id: '9', name: 'Quiet', type: 'quiet', x: 1, y: 1, w: 2, h: 2 },
    ])
    expect(office).not.toHaveProperty('whiteboards')
    expect(office.source).toBe('tiny.json')
  })
})

describe('the real office map', () => {
  const map = readJson(mapUrl)

  it('office.generated.json is up to date with assets/map (run npm run extract-map)', () => {
    const office = extractOffice(map, (tileset: { image: string }) =>
      PNG.sync.read(readFileSync(new URL(tileset.image, mapUrl)))
    )
    expect(office).toEqual(generated)
  })

  it('client and server use the same media zones', () => {
    expect(clientZones).toEqual(parseOfficeMap(map).zones)
  })

  it('the spawn and every chair seat are on walkable floor', () => {
    const tile = (px: number, py: number) =>
      generated.rows[Math.floor(py / generated.tileSize)][Math.floor(px / generated.tileSize)]
    expect(tile(generated.spawn.x, generated.spawn.y)).toBe('f')
    for (const chair of generated.chairs) expect(tile(chair.x, chair.y + 16), chair.id).toBe('f')
  })
})
