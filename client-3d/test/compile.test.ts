import { describe, expect, it } from 'vitest'
import { officeMapInfo } from '../../types/OfficeMap'
import { createCollision } from '../src/map/collision'
import { compileOffice, facingAngle, solidRects } from '../src/map/compile'
import { loadOfficeMap } from '../src/map/load'
import { bundledOffice } from '../src/map/office'
import { isLocalModelUrl } from '../src/world/modelUrl'
import { distanceTo, interactablesOf } from '../src/game/interactables'
import * as ops from '../src/editor/ops'
import { tinyMap } from './fixtures/tinyMap'

describe('compileOffice', () => {
  const office = compileOffice(tinyMap())

  it('turns the tile types into floor, walls and void, with their colours', () => {
    expect(office.rows).toEqual(['######', '#ffff#', '#ffff#', '#ffff#', '######'])
    expect(office.colors[0][0]).toBe('#eeeeee')
    expect(office.colors[1][1]).toBe('#dddddd')
    expect(office.spawn).toEqual({ x: 2.5, z: 2.5 })
    expect(office.spawnPx).toEqual({ x: 80, y: 61 })
  })

  it('makes chairs, computers and the other furniture out of the placements', () => {
    expect(office.chairs).toEqual([
      { id: 'chair-1', x: 1.5, z: 3.5, rot: Math.PI / 2, dir: 'right', color: '#aabbcc' },
    ])
    expect(office.computers).toEqual([{ id: 'pc-1', x: 3, y: 1, w: 2, h: 1, rotation: 0 }])
    expect(office.furniture.map((f) => [f.id, f.asset.id, f.collides])).toEqual([
      ['desk-1', 'desk', true],
    ])
  })

  it('uses a rotated vending machine’s map-oriented footprint for its interaction range', () => {
    const map = tinyMap()
    map.placements.push({
      id: 'vending-1',
      asset: 'vendingMachine',
      x: 2,
      y: 2,
      w: 1.5,
      h: 0.75,
    })
    const turned = ops.rotatePlacement(map, 'vending-1', 1)
    expect(turned.placements.at(-1)).toMatchObject({
      rotation: 90,
      x: 2,
      y: 1,
      w: 0.75,
      h: 1.5,
    })

    const vending = interactablesOf(compileOffice(turned)).vendingMachines[0]
    expect(vending.rect).toEqual({ x: 2, y: 1, w: 0.75, h: 1.5 })
    expect(distanceTo(vending, 1.5, 1.75)).toBeCloseTo(0.5)
  })

  it('blocks the footprints of colliding placements, or the tiles of their mask', () => {
    expect(office.blockers).toEqual([
      { x: 3, y: 1, w: 2, h: 1 }, // the computer desk
      { x: 3, y: 2, w: 1, h: 2 }, // the L-shaped desk: '#.' / '##'
      { x: 4, y: 3, w: 1, h: 1 },
    ])
    const collision = createCollision(office)
    expect(collision.isFree(4.5, 2.5)).toBe(true) // the free tile of the desk
    expect(collision.isFree(3.5, 2.5)).toBe(false)
    expect(collision.isFree(1.5, 3.5)).toBe(true) // chairs don't block
  })

  it('agrees with the server about zones, computers and the spawn', () => {
    const server = officeMapInfo(office.map)
    expect(office.zonesPx).toEqual(server.zones)
    expect(office.computers.map((c) => c.id)).toEqual(server.computerIds)
    expect(office.spawnPx).toEqual(server.spawn)
  })

  it('merges mask tiles into few rectangles and faces chairs like the 2D directions did', () => {
    expect(solidRects({ x: 10, y: 5, solid: ['###', '#.#', '###'] })).toEqual([
      { x: 10, y: 5, w: 3, h: 1 },
      { x: 10, y: 6, w: 1, h: 2 },
      { x: 12, y: 6, w: 1, h: 2 },
      { x: 11, y: 7, w: 1, h: 1 },
    ])
    expect([0, 90, 180, 270].map((r) => facingAngle(r as 0))).toEqual([
      0,
      Math.PI / 2,
      Math.PI,
      -Math.PI / 2,
    ])
  })
})

describe('loadOfficeMap (the map of the server, else the built-in one)', () => {
  const response = (status: number, body: string) =>
    (async () => new Response(body, { status })) as unknown as typeof fetch

  it('uses the map the server sends', async () => {
    const map = tinyMap()
    const loaded = await loadOfficeMap('http://office.test/map.json', {
      fetch: response(200, JSON.stringify(map)),
    })
    expect(loaded).toEqual({ map, source: 'server' })
  })

  it('falls back to the built-in map without a server or with a broken map', async () => {
    const quiet = { ...console, warn: () => {} }
    const original = globalThis.console
    globalThis.console = quiet
    try {
      for (const get of [
        response(500, 'oops'),
        response(200, '{"format":"nope"}'),
        (async () => {
          throw new TypeError('fetch failed')
        }) as unknown as typeof fetch,
      ]) {
        const loaded = await loadOfficeMap('http://office.test/map.json', { fetch: get })
        expect(loaded.source).toBe('built-in')
        expect(loaded.map).toBe(bundledOffice.map)
      }
    } finally {
      globalThis.console = original
    }
  })
})

describe('isLocalModelUrl (what a glTF model may load)', () => {
  const page = 'https://office.example.com/?editor'
  it('allows files below models/ of the page, and embedded data', () => {
    for (const url of [
      '/models/sofa.glb',
      'https://office.example.com/models/kit/a.bin',
      'data:application/octet-stream;base64,AA',
      'blob:https://office.example.com/1234',
    ])
      expect(isLocalModelUrl(url, page), url).toBe(true)
    expect(isLocalModelUrl('/office/models/a.glb', page, '/office/')).toBe(true)
  })

  it('refuses everything else', () => {
    for (const url of [
      'https://cdn.example.com/models/sofa.glb',
      '//cdn.example.com/models/sofa.glb',
      '/assets/index.js',
      '/models/../config.js',
      '/models/%2e%2e/config.js',
      'blob:https://evil.example.com/1234',
      'javascript:alert(1)',
    ])
      expect(isLocalModelUrl(url, page), url).toBe(false)
  })
})
