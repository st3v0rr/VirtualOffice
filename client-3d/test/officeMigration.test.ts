import { describe, expect, it } from 'vitest'
import { officeMapInfo } from '../../types/OfficeMap'
import { createCollision } from '../src/map/collision'
import { bundledOffice } from '../src/map/office'
import baseline from './fixtures/tiled-office-baseline.json'

// The office was converted from the Tiled map to the native format (assets/map/office.json).
// tiled-office-baseline.json is what the client and the server computed from the Tiled map
// before; the native office must behave the same: same walkable floor, the same collision
// cell by cell, the same chairs, computers, media zones and spawn. The few visual fixes of
// the conversion are listed below. Changing the office on purpose (e.g. with the editor)
// makes this test fail: then it has done its job, delete it or update the fixture.

const office = bundledOffice

type Rect = { asset: string; x: number; y: number; w: number; h: number }
const byPosition = (a: Rect, b: Rect) =>
  a.y - b.y || a.x - b.x || a.asset.localeCompare(b.asset) || a.w - b.w || a.h - b.h

// what the conversion changed on purpose, all of it decoration without collision changes
const REMOVED: Rect[] = [
  // the Tiled "Wall" layer drew the front of the wall here; as a picture it lay under the
  // picture of the same spot (z-fighting) ...
  { asset: 'picture', x: 34, y: 8, w: 1, h: 1 },
  // ... and here as an 11 tiles wide picture half behind another one
  { asset: 'picture', x: 36, y: 8, w: 11, h: 1 },
]
const REPLACED: [Rect, Rect][] = [
  // a green picture on the lounge wall: guessed to be a plant and drawn inside the wall
  [
    { asset: 'plant', x: 29, y: 4, w: 2, h: 2 },
    { asset: 'picture', x: 29, y: 4, w: 2, h: 2 },
  ],
]
const ADDED: Rect[] = [
  // blocked the way but wasn't drawn: a table in the boss office (its odd y of 4.0417 was
  // taken for a wall picture) and the desk without computer in the open office
  { asset: 'table', x: 33.75, y: 4.03125, w: 2, h: 2 },
  { asset: 'desk', x: 47, y: 23, w: 3, h: 2 },
]

const hexRows = (cells: Uint8Array, width: number) => {
  const rows: string[] = []
  for (let y = 0; y < cells.length / width; y++) {
    let row = ''
    for (let x = 0; x < width; x += 4) {
      let v = 0
      for (let i = 0; i < 4; i++) v = (v << 1) | cells[y * width + x + i]
      row += v.toString(16)
    }
    rows.push(row)
  }
  return rows
}

describe('the native office keeps the layout of the former Tiled map', () => {
  it('has the same size, floor, walls and void', () => {
    expect([office.width, office.height]).toEqual([baseline.width, baseline.height])
    expect(office.rows).toEqual(baseline.rows)
  })

  it('blocks exactly the same quarter-tile cells', () => {
    const collision = createCollision(office)
    const rows = hexRows(collision.blocked, collision.width)
    const differing = rows.flatMap((row, i) => (row === baseline.blocked[i] ? [] : [i]))
    expect(differing, 'rows of the collision grid that differ').toEqual([])
  })

  it('keeps every chair with its id, seat and direction', () => {
    const chairs = office.chairs.map(({ id, x, z, dir }) => ({ id, x, z, dir }))
    expect(chairs).toEqual(baseline.chairs)
  })

  it('keeps the computers, and the server sees the same spawn, computers and zones', () => {
    expect(office.computers.map(({ id, x, y, w, h }) => ({ id, x, y, w, h }))).toEqual(
      baseline.computers
    )
    const server = officeMapInfo(office.map)
    expect(server.spawn).toEqual(baseline.spawnPx)
    expect(server.computerIds).toEqual(baseline.computerIds)
    expect(server.zones).toEqual(baseline.zonesPx)
    expect(office.zonesPx).toEqual(baseline.zonesPx)
  })

  it('keeps the room labels', () => {
    expect(office.labels.map(({ text, x, z }) => ({ text, x, z }))).toEqual(baseline.labels)
  })

  it('stands the vending machine on the floor in front of its wall, blocking the same cells', () => {
    const [before] = baseline.vendingMachines
    const [after] = office.vendingMachines
    expect(after.id).toBe(before.id)
    expect([after.x, after.w, after.y + after.h]).toEqual([before.x, before.w, before.y + before.h])
    // the old sprite rectangle reached into the wall; now it starts at the wall's face
    expect(office.rows[after.y - 1][Math.floor(after.x)]).toBe('#')
    expect(office.rows[after.y][Math.floor(after.x)]).toBe('f')
  })

  it('draws the same furniture, apart from the listed fixes', () => {
    const key = (r: Rect) => JSON.stringify([r.asset, r.x, r.y, r.w, r.h])
    const removed = new Set([...REMOVED, ...REPLACED.map(([from]) => from)].map(key))
    const expected = [
      ...baseline.furniture.filter((r) => !removed.has(key(r))),
      ...REPLACED.map(([, to]) => to),
      ...ADDED,
    ].sort(byPosition)
    const actual = office.furniture
      .map(({ asset, x, y, w, h }) => ({ asset: asset.id, x, y, w, h }))
      .sort(byPosition)
    expect(actual).toEqual(expected)
  })
})
