import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assetCatalog, BUILTIN_ASSETS, findAsset, placementCollides } from '../../types/map/catalog'
import { tileToWire, wireToTile } from '../../types/map/format'
import { formatMap } from '../../types/map/serialize'
import {
  assertValidMap,
  checkModelSource,
  describeIssues,
  MAP_LIMITS,
  MapValidationError,
  modelUrl,
  parseMap,
  validateMap,
} from '../../types/map/validate'
import { findZone, officeMapInfo } from '../../types/OfficeMap'
import { tinyMap } from './fixtures/tinyMap'

const officeText = readFileSync(new URL('../../assets/map/office.json', import.meta.url), 'utf8')

// the problems of a map with one change, as "path: message" lines
function problems(change: (map: Record<string, any>) => void) {
  const map = structuredClone(tinyMap()) as Record<string, any>
  change(map)
  const result = validateMap(map)
  return result.ok ? [] : result.errors.map((e) => `${e.path}: ${e.message}`)
}

describe('the shipped office map', () => {
  it('is a valid map', () => {
    const result = parseMap(officeText)
    expect(result.ok, result.ok ? '' : describeIssues(result.errors)).toBe(true)
  })

  it('is stored in the layout of the serializer, so saving it unchanged changes nothing', () => {
    expect(formatMap(assertValidMap(JSON.parse(officeText)))).toBe(officeText)
  })
})

describe('validateMap', () => {
  it('accepts a valid map and returns a copy with only the known fields', () => {
    const input = tinyMap()
    const result = validateMap(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.map).toEqual(input)
    expect(result.map).not.toBe(input)
    input.placements[0].x = 99
    expect(result.map.placements[0].x).toBe(1)
  })

  it('fills in empty lists for labels, zones, assets and placements', () => {
    const map: Record<string, unknown> = { ...tinyMap() }
    for (const key of ['labels', 'zones', 'assets', 'placements']) delete map[key]
    const result = validateMap(map)
    expect(
      result.ok && [result.map.labels, result.map.zones, result.map.assets, result.map.placements]
    ).toEqual([[], [], [], []])
  })

  it('refuses what is not a map at all', () => {
    for (const input of [null, [], 'map', 42])
      expect(validateMap(input)).toEqual({
        ok: false,
        errors: [{ path: '', message: 'a map must be a JSON object' }],
      })
    expect(problems((m) => (m.format = 'other'))).toEqual([
      'format: must be "virtualoffice-map", this is not a VirtualOffice map',
    ])
  })

  it('recognizes a Tiled map and says that Tiled is no longer read', () => {
    const result = validateMap({ tiledversion: '1.7.0', layers: [], tilesets: [] })
    expect(result.ok === false && result.errors[0].message).toMatch(/Tiled map/)
  })

  it('names the version a newer file needs', () => {
    expect(problems((m) => (m.version = 2))).toEqual([
      'version: version 2 is newer than this VirtualOffice understands (1)',
    ])
    expect(problems((m) => (m.version = '1'))).toEqual(['version: must be 1'])
  })

  it('reports unknown properties (typos) instead of ignoring them', () => {
    expect(problems((m) => (m.colour = 'red'))).toEqual([': unknown property "colour"'])
    expect(problems((m) => (m.placements[1].colour = '#ffffff'))).toEqual([
      'placements[1]: unknown property "colour"',
    ])
  })

  it('checks the size and the grid', () => {
    expect(problems((m) => (m.tileSize = 16))).toEqual([
      'tileSize: must be 32 (the map pixels per tile of the network protocol)',
    ])
    expect(problems((m) => (m.width = 0))).toContain('width: must be at least 1')
    expect(problems((m) => (m.width = 2.5))).toContain('width: must be a whole number')
    expect(problems((m) => (m.height = MAP_LIMITS.maxSize + 1))).toContain(
      `height: must be at most ${MAP_LIMITS.maxSize}`
    )
    expect(problems((m) => m.tiles.pop())).toContain('tiles: has 4 rows, the map is 5 tiles high')
    expect(problems((m) => (m.tiles[1] = '#fff#'))).toEqual([
      'tiles[1]: has 5 characters, the map is 6 tiles wide',
    ])
    expect(problems((m) => (m.tiles[2] = '#ffxf#'))).toEqual([
      'tiles[2]: unknown tile type "x" (column 3)',
    ])
  })

  it('checks the tile types, and reports a broken type once instead of for every tile', () => {
    expect(problems((m) => (m.tileTypes.f.color = 'green'))).toEqual([
      'tileTypes["f"].color: must be a colour like "#a1b2c3"',
    ])
    expect(problems((m) => (m.tileTypes['.'].color = '#000000'))).toEqual([
      'tileTypes["."].color: void tiles have no colour',
    ])
    expect(
      problems((m) => (m.tileTypes.ab = { kind: 'floor', name: 'x', color: '#000000' }))
    ).toEqual([
      'tileTypes["ab"]: the key must be one visible ASCII character (no space, quote or backslash)',
    ])
    expect(problems((m) => (m.tileTypes.f.kind = 'lava'))).toEqual([
      'tileTypes["f"].kind: must be one of "void", "floor", "wall"',
    ])
  })

  it('is not fooled by a "__proto__" key', () => {
    const map = JSON.parse(
      JSON.stringify(tinyMap()).replace(
        '"tileTypes":{',
        '"tileTypes":{"__proto__":{"polluted":true},'
      )
    )
    const result = validateMap(map)
    expect(result.ok).toBe(false)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('needs the spawn on a floor tile inside the map', () => {
    expect(problems((m) => (m.spawn = { x: 0.5, y: 0.5 }))).toEqual([
      'spawn: (0.5, 0.5) must be on a floor tile, not on wall',
    ])
    expect(problems((m) => (m.spawn = { x: 6, y: 2 }))).toEqual(['spawn: must be inside the map'])
    expect(problems((m) => (m.spawn = { x: '2', y: 2 }))).toEqual(['spawn.x: must be a number'])
  })

  it('checks labels and zones', () => {
    expect(problems((m) => (m.labels[0].text = '  '))).toEqual([
      'labels[0].text: must not be empty',
    ])
    expect(problems((m) => (m.zones[0].type = 'party'))).toEqual([
      'zones[0].type: must be one of "meeting", "focus", "quiet", "auditorium", "stage"',
    ])
    expect(problems((m) => (m.zones[0].w = 0))).toEqual(['zones[0].w: must be greater than 0'])
    expect(problems((m) => (m.zones[0].x = 5))).toEqual([
      'zones[0]: (5, 1, 2 x 2) is not inside the 6 x 5 map',
    ])
    expect(problems((m) => m.zones.push({ ...m.zones[0] }))).toEqual([
      'zones[1].id: "z1" is used twice, ids must be unique',
    ])
  })

  it('only takes plain ids, they end up in media room names', () => {
    for (const id of ['a b', '../x', '', '-x', 'x'.repeat(65), 7])
      expect(problems((m) => (m.placements[0].id = id))[0]).toMatch(
        /^placements\[0\]\.id: must be an id/
      )
    expect(problems((m) => (m.placements[1].id = 'chair-1'))).toEqual([
      'placements[1].id: "chair-1" is used twice, ids must be unique',
    ])
  })

  it('checks placements: asset, footprint, rotation, colour, collision', () => {
    expect(problems((m) => (m.placements[0].asset = 'sofa'))[0]).toMatch(
      /^placements\[0\]\.asset: unknown asset "sofa" \(built in: chair, table, .*; or define it in "assets"\)$/
    )
    expect(problems((m) => (m.placements[1].x = 5))).toEqual([
      'placements[1]: (5, 1, 2 x 1) is not inside the 6 x 5 map',
    ])
    expect(problems((m) => (m.placements[1].w = -1))).toEqual([
      'placements[1].w: must be greater than 0',
    ])
    expect(problems((m) => (m.placements[0].rotation = 45))).toEqual([
      'placements[0].rotation: must be one of 0, 90, 180, 270',
    ])
    expect(problems((m) => (m.placements[0].color = 'red'))).toEqual([
      'placements[0].color: must be a colour like "#a1b2c3"',
    ])
    expect(problems((m) => (m.placements[0].collides = 'yes'))).toEqual([
      'placements[0].collides: must be true or false',
    ])
  })

  it('turns only the assets the catalog marks rotatable, like the editor', () => {
    expect(problems((m) => (m.placements[1].rotation = 90))).toEqual([
      'placements[1].rotation: must be 0, "computer" can\'t be turned',
    ])
    expect(problems((m) => (m.placements[1].rotation = 0))).toEqual([])
    for (const a of BUILTIN_ASSETS)
      expect(
        problems((m) => Object.assign(m.placements[1], { asset: a.id, rotation: 270 })),
        a.id
      ).toHaveLength(a.rotatable ? 0 : 1)
  })

  it('checks collision masks against the footprint', () => {
    expect(problems((m) => (m.placements[2].solid = ['#.']))).toEqual([
      'placements[2].solid: needs 2 rows, one per tile of h',
    ])
    expect(problems((m) => (m.placements[2].solid = ['#x', '##']))).toEqual([
      'placements[2].solid: rows must be 2 characters of "#" (blocks) and "." (free)',
    ])
    expect(problems((m) => Object.assign(m.placements[2], { w: 1.5 }))).toEqual([
      'placements[2].solid: needs a footprint of whole tiles (at most 32)',
    ])
  })

  it('limits the number of things in a map', () => {
    const placements = Array.from({ length: MAP_LIMITS.maxPlacements + 1 }, (_, i) => ({
      id: `p${i}`,
      asset: 'plant',
      x: 1,
      y: 1,
      w: 1,
      h: 1,
    }))
    expect(problems((m) => (m.placements = placements))).toEqual([
      `placements: has ${placements.length} entries, at most ${MAP_LIMITS.maxPlacements} are allowed`,
    ])
  })
})

describe('assets of the map (local glTF models)', () => {
  const withSofa = (src: unknown) =>
    problems((m) => {
      m.assets = [
        {
          id: 'sofa',
          name: 'Sofa',
          category: 'seating',
          w: 2,
          h: 1,
          collides: true,
          model: { src },
        },
      ]
      m.placements.push({ id: 'sofa-1', asset: 'sofa', x: 1, y: 1, w: 2, h: 1 })
    })

  it('can be placed like built-in assets', () => {
    expect(withSofa('furniture/sofa.glb')).toEqual([])
    const map = tinyMap()
    map.assets = [
      {
        id: 'sofa',
        name: 'Sofa',
        category: 'seating',
        w: 2,
        h: 1,
        collides: true,
        model: { src: 'sofa.glb', scale: 0.5 },
      },
    ]
    expect(findAsset(map, 'sofa')).toMatchObject({
      id: 'sofa',
      builtin: false,
      model: { src: 'sofa.glb', scale: 0.5 },
    })
    expect(assetCatalog(map).at(-1)?.id).toBe('sofa')
    expect(modelUrl('kit/sofa.glb')).toBe('/models/kit/sofa.glb')
    expect(modelUrl('sofa.glb', '/office')).toBe('/office/models/sofa.glb')
  })

  it('only refer to .glb/.gltf files below models/, never to other places', () => {
    for (const ok of ['sofa.glb', 'kit/chair-1.gltf', 'a_b/c.d.GLB'])
      expect(checkModelSource(ok), ok).toBeNull()
    for (const bad of [
      'https://cdn.example.com/sofa.glb',
      '//cdn.example.com/sofa.glb',
      'data:model/gltf-binary;base64,AAAA',
      'javascript:alert(1)//.glb',
      '/models/sofa.glb',
      '../sofa.glb',
      'kit/../../secret.glb',
      './sofa.glb',
      'kit\\sofa.glb',
      '%2e%2e/sofa.glb',
      'sofa.glb?v=1',
      'sofa.png',
      '.hidden.glb',
      '',
      42,
    ])
      expect(checkModelSource(bad), String(bad)).not.toBeNull()
    expect(withSofa('https://cdn.example.com/sofa.glb')).toEqual([
      'assets[0].model.src: must be a relative path below models/, not a URL',
    ])
  })

  it('may not take the id of a built-in asset', () => {
    expect(
      problems((m) => {
        m.assets = [
          {
            id: 'chair',
            name: 'X',
            category: 'seating',
            w: 1,
            h: 1,
            collides: false,
            model: { src: 'x.glb' },
          },
        ]
      })
    ).toEqual(['assets[0].id: "chair" is a built-in asset, choose another id'])
  })
})

describe('parseMap, errors', () => {
  it('reports invalid JSON and files that are too big', () => {
    const broken = parseMap('{"format": ')
    expect(broken.ok === false && broken.errors[0].message).toMatch(/^not valid JSON: /)
    const big = parseMap(' '.repeat(MAP_LIMITS.maxFileSize + 1))
    expect(big.ok === false && big.errors[0].message).toMatch(/too big/)
  })

  it('lists the problems readably, and not endlessly', () => {
    const issues = Array.from({ length: 25 }, (_, i) => ({
      path: `zones[${i}]`,
      message: 'broken',
    }))
    const text = describeIssues(issues)
    expect(text.split('\n')).toHaveLength(21)
    expect(text).toContain('  - zones[0]: broken')
    expect(text).toContain('… and 5 more')
    expect(() => assertValidMap({ format: 'x' }, 'test.json')).toThrow(MapValidationError)
    expect(() => assertValidMap({ format: 'x' }, 'test.json')).toThrow(
      /Invalid test\.json:\n {2}- format:/
    )
  })
})

describe('the catalog', () => {
  it('has unique ids and the assets with a role in the office', () => {
    const ids = BUILTIN_ASSETS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(BUILTIN_ASSETS.filter((a) => 'role' in a).map((a) => [a.id, a.role])).toEqual([
      ['chair', 'chair'],
      ['computer', 'computer'],
      ['vendingMachine', 'vending'],
    ])
    for (const a of BUILTIN_ASSETS) expect(a.w > 0 && a.h > 0, a.id).toBe(true)
  })

  it('a placement blocks like its asset unless it says otherwise', () => {
    const table = findAsset(tinyMap(), 'table')
    expect(placementCollides({}, table)).toBe(true)
    expect(placementCollides({ collides: false }, table)).toBe(false)
    expect(placementCollides({}, findAsset(tinyMap(), 'chair'))).toBe(false)
  })
})

describe('what the server takes from a map', () => {
  it('has the computers, the spawn on the wire and the zones in map pixels', () => {
    expect(officeMapInfo(tinyMap())).toEqual({
      computerIds: ['pc-1'],
      spawn: { x: 80, y: 61 },
      zones: [{ id: 'z1', name: 'Meeting', type: 'meeting', x: 32, y: 32, width: 64, height: 64 }],
    })
  })

  it('converts between tiles and the wire both ways', () => {
    expect(tileToWire(36.03125, 16.21875)).toEqual({ x: 1153, y: 500 })
    expect(wireToTile(1153, 500)).toEqual({ x: 36.03125, y: 16.21875 })
  })

  it('findZone picks the smallest zone containing the point', () => {
    const zones = officeMapInfo({
      ...tinyMap(),
      zones: [
        { id: 'hall', name: 'Hall', type: 'auditorium', x: 1, y: 1, w: 4, h: 3 },
        { id: 'stage', name: 'Stage', type: 'stage', x: 1, y: 1, w: 2, h: 1 },
      ],
    }).zones
    expect(findZone(zones, 40, 40)?.id).toBe('stage')
    expect(findZone(zones, 40, 80)?.id).toBe('hall')
    expect(findZone(zones, 10, 10)).toBeUndefined()
  })
})
