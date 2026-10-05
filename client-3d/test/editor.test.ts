import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VirtualOfficeMap } from '../../types/map/format'
import { describeIssues, validateMap } from '../../types/map/validate'
import { analyzeMap } from '../src/editor/analysis'
import {
  clearDraft,
  DRAFT_KEY,
  exportMap,
  importMap,
  loadDraft,
  mapFileName,
  saveDraft,
} from '../src/editor/io'
import * as ops from '../src/editor/ops'
import { INITIAL, useEditor } from '../src/editor/store'
import { bundledOffice } from '../src/map/office'
import { tinyMap } from './fixtures/tinyMap'

const officeText = readFileSync(new URL('../../assets/map/office.json', import.meta.url), 'utf8')

// every edit must leave a map the server would accept
function valid(map: VirtualOfficeMap) {
  const result = validateMap(map)
  expect(result.ok, result.ok ? '' : describeIssues(result.errors)).toBe(true)
  return map
}

const placement = (map: VirtualOfficeMap, id: string) => ops.findPlacement(map, id)!

describe('editing placements', () => {
  it('places an asset from the catalog centred on the pointer, on the grid, with a new id', () => {
    const first = ops.placeAsset(tinyMap(), 'plant', 2.4, 2.6)
    expect(first.id).toBe('plant-1')
    expect(placement(first.map, 'plant-1')).toEqual({
      id: 'plant-1',
      asset: 'plant',
      x: 2,
      y: 2,
      w: 1,
      h: 1,
    })
    const second = ops.placeAsset(first.map, 'plant', 2, 2)
    expect(second.id).toBe('plant-2')
    // a table (3 x 2) at the edge is moved inside the map
    const table = ops.placeAsset(tinyMap(), 'table', 5.9, 4.9)
    expect(placement(table.map, table.id)).toMatchObject({ x: 3, y: 3, w: 3, h: 2 })
    valid(table.map)
    expect(() => ops.placeAsset(tinyMap(), 'sofa', 1, 1)).toThrow(/Unknown asset/)
  })

  it('moves and resizes inside the map; a mask that no longer fits is dropped', () => {
    const map = tinyMap()
    expect(ops.movePlacement(map, 'pc-1', 3, 1)).toBe(map)
    const moved = ops.movePlacement(map, 'pc-1', 10, -3)
    expect(placement(moved, 'pc-1')).toMatchObject({ x: 4, y: 0 })
    const resized = valid(ops.resizePlacement(map, 'desk-1', 3, 2))
    expect(placement(resized, 'desk-1')).toEqual({
      id: 'desk-1',
      asset: 'desk',
      x: 3,
      y: 2,
      w: 3,
      h: 2,
    })
    expect(placement(ops.resizePlacement(map, 'desk-1', 0, 2), 'desk-1').w).toBe(0.25)
  })

  it('turns placements around their centre, staying on the grid, with their mask', () => {
    let map = ops.placeAsset(tinyMap(), 'table', 2.5, 2).map
    expect(placement(map, 'table-1')).toMatchObject({ x: 1, y: 1, w: 3, h: 2 })
    // clockwise: from facing south to facing west
    map = ops.rotatePlacement(map, 'table-1', -1)
    expect(placement(map, 'table-1')).toMatchObject({ rotation: 270, x: 1, y: 0, w: 2, h: 3 })
    // turning on doesn't make it wander off
    for (let i = 0; i < 3; i++) map = ops.rotatePlacement(map, 'table-1', -1)
    expect(placement(map, 'table-1')).toMatchObject({ rotation: 0, x: 1, y: 1, w: 3, h: 2 })
    map = ops.rotatePlacement(ops.rotatePlacement(map, 'table-1', 1), 'table-1', -1)
    expect(placement(map, 'table-1')).toMatchObject({ rotation: 0, x: 1, y: 1, w: 3, h: 2 })
    // the L-shaped desk: its free tile turns with it
    const turned = ops.rotatePlacement(tinyMap(), 'desk-1', 1)
    expect(placement(turned, 'desk-1')).toMatchObject({ rotation: 90, solid: ['.#', '##'] })
    expect(ops.rotateMask(['##', '#.', '#.', '##'], 1)).toEqual(['#..#', '####'])
    expect(ops.rotateMask(['##', '#.', '#.', '##'], 4)).toEqual(['##', '#.', '#.', '##'])
    // plants can't be turned
    const plant = ops.placeAsset(tinyMap(), 'plant', 2, 2)
    expect(ops.rotatePlacement(plant.map, plant.id, 1)).toBe(plant.map)
  })

  it('duplicates, deletes and switches the collision of single tiles', () => {
    const copy = ops.duplicatePlacement(tinyMap(), 'desk-1')
    expect(copy.id).toBe('desk-2')
    expect(placement(copy.map, 'desk-2')).toMatchObject({ x: 4, y: 3, solid: ['#.', '##'] })
    expect(ops.deletePlacement(copy.map, 'desk-1').placements.map((p) => p.id)).toEqual([
      'chair-1',
      'pc-1',
      'desk-2',
    ])

    let map = ops.setSolidCell(tinyMap(), 'pc-1', 1, 0, false)
    expect(placement(map, 'pc-1').solid).toEqual(['#.'])
    map = ops.setSolidCell(map, 'pc-1', 1, 0, true)
    expect(placement(map, 'pc-1').solid).toBeUndefined()
    const half = ops.updatePlacement(tinyMap(), 'pc-1', { w: 1.5 })
    expect(ops.setSolidCell(half, 'pc-1', 0, 0, false)).toBe(half)
    expect(
      ops.updatePlacement(tinyMap(), 'chair-1', { color: undefined }).placements[0]
    ).not.toHaveProperty('color')
  })
})

describe('editing tiles, zones, labels and the map', () => {
  it('paints tiles, rectangles and rooms', () => {
    const map = tinyMap()
    expect(ops.setTiles(map, [{ x: 1, y: 1 }], 'f')).toBe(map)
    const painted = ops.setTiles(
      map,
      [
        { x: 1, y: 1 },
        { x: 9, y: 9 },
      ],
      '#'
    )
    expect(painted.tiles[1]).toBe('##fff#')
    expect(painted.tiles[0]).toBe(map.tiles[0])
    expect(ops.fillRect(map, { x: 1, y: 1, w: 2, h: 2 }, '.').tiles.slice(1, 3)).toEqual([
      '#..ff#',
      '#..ff#',
    ])
    const room = ops.drawRoom(
      ops.fillRect(map, { x: 0, y: 0, w: 6, h: 5 }, '.'),
      { x: 1, y: 0, w: 4, h: 4 },
      'f',
      '#'
    )
    expect(room.tiles).toEqual(['.####.', '.#ff#.', '.#ff#.', '.####.', '......'])
    expect(() => ops.setTiles(map, [{ x: 1, y: 1 }], 'x')).toThrow(/Unknown tile type/)
    expect(ops.cellRect({ x: 3.7, y: 2.2 }, { x: 1.1, y: 0.5 })).toEqual({ x: 1, y: 0, w: 3, h: 3 })
  })

  it('adds, renames and removes tile types; used ones stay', () => {
    const added = ops.addTileType(tinyMap(), { kind: 'floor', name: 'Teppich', color: '#ffeeee' })
    expect(added.key).toBe('a')
    const renamed = ops.updateTileType(added.map, 'a', { name: 'Läufer' })
    expect(renamed.tileTypes.a).toEqual({ kind: 'floor', name: 'Läufer', color: '#ffeeee' })
    expect(ops.removeTileType(renamed, 'a').tileTypes).not.toHaveProperty('a')
    expect(ops.removeTileType(renamed, 'f')).toBe(renamed)
    valid(renamed)
  })

  it('sets the spawn, zones and labels inside the map', () => {
    expect(ops.setSpawn(tinyMap(), 9, -1).spawn).toEqual({ x: 5.999, y: 0 })
    const zone = ops.addZone(tinyMap(), { x: 3, y: 2, w: 9, h: 2 }, 'quiet')
    expect(zone.map.zones.at(-1)).toEqual({
      id: 'zone-1',
      name: 'Neue Zone',
      type: 'quiet',
      x: 0,
      y: 2,
      w: 6,
      h: 2,
    })
    const smaller = ops.updateZone(zone.map, 'zone-1', { w: 0, name: 'Bibliothek' })
    expect(smaller.zones.at(-1)).toMatchObject({ name: 'Bibliothek', w: 0.25 })
    expect(ops.deleteZone(smaller, 'zone-1').zones).toHaveLength(1)
    const label = ops.addLabel(tinyMap(), 7, 2, 'Küche')
    expect(label.map.labels.at(-1)).toEqual({ id: 'label-1', text: 'Küche', x: 6, y: 2 })
    expect(ops.updateLabel(label.map, 'label-1', { x: -2 }).labels.at(-1)?.x).toBe(0)
    expect(ops.deleteLabel(label.map, 'label-1').labels).toHaveLength(1)
    valid(smaller)
  })

  it('resizes the map: grows with void, cuts what no longer fits', () => {
    const grown = valid(ops.resizeMap(tinyMap(), 8, 6).map)
    expect(grown.tiles).toHaveLength(6)
    expect(grown.tiles[1]).toBe('#ffff#..')
    const cut = ops.resizeMap(tinyMap(), 4, 5)
    expect(cut.removed).toBe(2) // the computer and the desk reach beyond x = 4
    expect(cut.map.placements.map((p) => p.id)).toEqual(['chair-1'])
    valid(cut.map)
  })

  it('creates a new, valid map with one room', () => {
    const map = valid(ops.createMap(10, 8))
    expect(map.tiles[0]).toBe('..........')
    expect(map.tiles[1]).toBe('.########.')
    expect(map.tiles[2]).toBe('.#gggggg#.')
  })
})

describe('the editor store: undo, redo and drags', () => {
  beforeEach(() => {
    useEditor.setState(INITIAL)
    useEditor.getState().load(tinyMap(), 'server')
  })

  it('undoes and redoes every change', () => {
    const s = () => useEditor.getState()
    const start = s().map!
    s().apply((m) => ops.setSpawn(m, 3.5, 3.5))
    s().apply((m) => ops.deletePlacement(m, 'pc-1'))
    expect(s().past).toHaveLength(2)
    s().undo()
    expect(ops.findPlacement(s().map!, 'pc-1')).toBeDefined()
    s().undo()
    expect(s().map).toBe(start)
    s().redo()
    expect(s().map!.spawn).toEqual({ x: 3.5, y: 3.5 })
    // a new change drops what could be redone
    s().apply((m) => ops.setSpawn(m, 1.5, 1.5))
    expect(s().future).toEqual([])
  })

  it('makes a whole drag one step', () => {
    const s = () => useEditor.getState()
    const start = s().map!
    s().begin()
    for (const x of [1, 2, 3]) s().apply((m) => ops.movePlacement(m, 'chair-1', x, 3))
    s().end()
    expect(s().past).toEqual([start])
    s().undo()
    expect(s().map).toBe(start)
  })

  it('forgets a selection that undo took away, and marks edits for the draft', () => {
    const s = () => useEditor.getState()
    expect(s().edited).toBe(false)
    const placed = ops.placeAsset(s().map!, 'plant', 2, 2)
    s().apply(() => placed.map, { kind: 'placement', id: placed.id })
    expect(s().selection).toEqual({ kind: 'placement', id: 'plant-1' })
    expect(s().edited).toBe(true)
    s().undo()
    expect(s().selection).toBeNull()
    // loading another map can be undone too
    s().load(ops.createMap(), 'new')
    s().undo()
    expect(s().map!.name).toBe('Tiny')
  })
})

describe('import, export and the draft in the browser', () => {
  it('exports the office exactly like its file, and imports it again', () => {
    expect(exportMap(bundledOffice.map)).toBe(officeText)
    const imported = importMap(exportMap(tinyMap()))
    expect(imported).toEqual({ ok: true, map: tinyMap() })
  })

  it('refuses broken files with the reasons', () => {
    const result = importMap('{"format":"virtualoffice-map","version":1}')
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.errors.map((e) => e.path)).toContain('name')
    expect(importMap('not json').ok).toBe(false)
  })

  it('names the file after the map', () => {
    expect(mapFileName({ name: 'Mein Büro 2' })).toBe('mein-buero-2.json')
    expect(mapFileName({ name: '!!!' })).toBe('office.json')
  })

  describe('drafts', () => {
    const storage = new Map<string, string>()
    const fake = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    }
    afterEach(() => {
      storage.clear()
      vi.restoreAllMocks()
    })

    it('keeps a draft and gives it back', () => {
      expect(loadDraft(fake)).toBeNull()
      expect(saveDraft(fake, tinyMap())).toBe(true)
      expect(loadDraft(fake)).toEqual(tinyMap())
      clearDraft(fake)
      expect(loadDraft(fake)).toBeNull()
    })

    it('ignores a broken draft, and survives a full storage', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      storage.set(DRAFT_KEY, '{"format":"virtualoffice-map"}')
      expect(loadDraft(fake)).toBeNull()
      const full = {
        ...fake,
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      }
      expect(saveDraft(full, tinyMap())).toBe(false)
    })
  })
})

describe('the checks of the editor', () => {
  it('finds nothing wrong with the office', () => {
    const report = analyzeMap(bundledOffice.map)
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
    expect(report.office?.chairs).toHaveLength(79)
  })

  it('reports chairs and computers nobody can reach any more', () => {
    // a wall through the room cuts off its right part (computer, desk, chair) from the spawn
    let map = ops.setSpawn(tinyMap(), 1.5, 2.5)
    map = ops.fillRect(map, { x: 2, y: 1, w: 1, h: 3 }, '#')
    const report = analyzeMap(ops.movePlacement(map, 'chair-1', 4, 3))
    expect(report.warnings.map((w) => w.ids)).toEqual([['chair-1'], ['pc-1']])
    expect(report.warnings[0].message).toMatch(/nicht erreichbar/)
  })

  it('reports a blocked spawn, furniture in walls and pictures without a wall', () => {
    let map = ops.placeAsset(tinyMap(), 'block', 2.5, 2.5).map // on the spawn
    map = ops.placeAsset(map, 'plant', 0.5, 0.5).map // in the wall
    map = ops.placeAsset(map, 'picture', 3, 3).map // in the middle of the room
    const messages = analyzeMap(map).warnings.map((w) => w.message)
    expect(messages).toEqual([
      expect.stringMatching(/Startpunkt ist blockiert/),
      expect.stringMatching(/Steht nicht auf dem Boden: plant-1/),
      expect.stringMatching(/Hängt an keiner Wand.*picture-1/),
    ])
  })

  it('lists the errors of an invalid map, and still has an office for the preview', () => {
    const report = analyzeMap(ops.setTiles(tinyMap(), [{ x: 2, y: 2 }], '#'))
    expect(report.errors.map((e) => e.path)).toEqual(['spawn'])
    expect(report.office?.rows[2]).toBe('#f#ff#')
  })
})
