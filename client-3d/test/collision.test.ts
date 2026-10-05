import { describe, expect, it } from 'vitest'
import { findPath, isFree, move } from '../src/map/collision'
import { office, tileAt, toWorld } from '../src/map/office'

const spawn = toWorld(office.spawn.x, office.spawn.y)

// every point along the line is walkable (finer than the collision grid)
const segmentFree = (a: { x: number; z: number }, b: { x: number; z: number }) => {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.05)
  for (let i = 0; i <= n; i++) {
    if (!isFree(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false
  }
  return true
}

describe('isFree', () => {
  it('the spawn is free, walls and the void are not', () => {
    expect(tileAt(Math.floor(spawn.x), Math.floor(spawn.z))).toBe('f')
    expect(isFree(spawn.x, spawn.z)).toBe(true)
    // the corridor wall left of the spawn (row 16, column 33)
    expect(tileAt(33, 16)).toBe('#')
    expect(isFree(33.5, 16.5)).toBe(false)
    expect(isFree(-5, -5)).toBe(false)
    expect(isFree(office.width + 1, 3)).toBe(false)
  })

  it('checks the whole feet box, not only its centre', () => {
    // right next to the wall the centre is on the floor, but the box overlaps the wall
    expect(isFree(34.1, spawn.z)).toBe(false)
    expect(isFree(34.3, spawn.z)).toBe(true)
  })
})

describe('move', () => {
  it('walks freely on the floor', () => {
    expect(move(spawn.x, spawn.z, 0, 0.5)).toEqual({ x: spawn.x, z: spawn.z + 0.5 })
  })

  it('slides along a wall instead of stopping', () => {
    const after = move(spawn.x, spawn.z, -3, 0.5)
    expect(after.x).toBeGreaterThanOrEqual(34.25)
    expect(after.x).toBeLessThan(34.5)
    expect(after.z).toBeCloseTo(spawn.z + 0.5)
  })

  it('does not tunnel through a wall on a big step', () => {
    expect(move(spawn.x, spawn.z, -20, 0).x).toBeGreaterThan(34)
  })
})

describe('findPath (click to walk)', () => {
  it('goes straight when nothing is in the way', () => {
    const target = { x: 36, z: 22 }
    expect(segmentFree(spawn, target)).toBe(true)
    expect(findPath(spawn.x, spawn.z, target.x, target.z)).toEqual([target])
  })

  it('smooths the grid path around corners to a few walkable segments', () => {
    const library = office.zones.find((z) => z.type === 'quiet')!
    const target = { x: library.x + library.w / 2, z: library.y + library.h / 2 }
    expect(segmentFree(spawn, target)).toBe(false)
    const path = findPath(spawn.x, spawn.z, target.x, target.z)!
    expect(path.length).toBeGreaterThan(1)
    // string pulling leaves only the corners, not one point per grid cell
    expect(path.length).toBeLessThanOrEqual(4)
    expect(path.at(-1)).toEqual(target)
    let from = spawn
    for (const point of path) {
      expect(segmentFree(from, point)).toBe(true)
      from = point
    }
  })

  it('finds a walkable way to every chair', () => {
    for (const chair of office.chairs) {
      const target = { x: chair.x / office.tileSize, z: (chair.y + 16) / office.tileSize }
      const path = findPath(spawn.x, spawn.z, target.x, target.z)
      expect(path, `chair ${chair.id}`).not.toBeNull()
      let from = spawn
      for (const point of path!) {
        expect(segmentFree(from, point), `chair ${chair.id}`).toBe(true)
        from = point
      }
    }
  })

  it('finds collision-free, no-corner-cutting routes to far reachable targets', () => {
    const farTargets = [
      { x: 1, z: 36 },
      { x: 27, z: 36 },
    ]
    for (const target of farTargets) {
      const path = findPath(spawn.x, spawn.z, target.x, target.z)
      expect(path, `target (${target.x}, ${target.z})`).not.toBeNull()
      let from = spawn
      for (const point of path!) {
        expect(segmentFree(from, point)).toBe(true)
        from = point
      }
    }
  })

  it('ends at the closest walkable point when the target is inside a wall', () => {
    const path = findPath(spawn.x, spawn.z, 33.5, 16.5)!
    const end = path.at(-1)!
    expect(isFree(end.x, end.z)).toBe(true)
    expect(Math.hypot(end.x - 33.5, end.z - 16.5)).toBeLessThan(1.2)
  })
})
