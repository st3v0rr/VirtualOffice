import { describe, expect, it } from 'vitest'
import { FAR_DISTANCE, NEAR_DISTANCE, updateNearby } from '../src/proximity'

const distances = (entries: Record<string, number>) => new Map(Object.entries(entries))

describe('updateNearby (open office hysteresis)', () => {
  it('uses a gap between joining (110 px) and leaving (170 px)', () => {
    expect(NEAR_DISTANCE).toBe(110)
    expect(FAR_DISTANCE).toBe(170)
  })

  it('starts listening at NEAR_DISTANCE, not before', () => {
    const nearby = new Set<string>()
    expect(updateNearby(nearby, distances({ a: NEAR_DISTANCE + 1 }))).toBe(false)
    expect(nearby.has('a')).toBe(false)
    expect(updateNearby(nearby, distances({ a: NEAR_DISTANCE }))).toBe(true)
    expect(nearby.has('a')).toBe(true)
  })

  it('keeps listening inside the gap and stops only beyond FAR_DISTANCE', () => {
    const nearby = new Set(['a'])
    expect(updateNearby(nearby, distances({ a: 140 }))).toBe(false)
    expect(updateNearby(nearby, distances({ a: FAR_DISTANCE }))).toBe(false)
    expect(nearby.has('a')).toBe(true)
    expect(updateNearby(nearby, distances({ a: FAR_DISTANCE + 0.5 }))).toBe(true)
    expect(nearby.has('a')).toBe(false)
  })

  it('does not pick up someone walking by inside the gap', () => {
    const nearby = new Set<string>()
    for (const d of [300, 200, 150, 120, 150, 200]) updateNearby(nearby, distances({ a: d }))
    expect(nearby.size).toBe(0)
  })

  it('drops players that are gone or have no distance any more', () => {
    const nearby = new Set(['a', 'b'])
    expect(updateNearby(nearby, distances({ a: 50 }))).toBe(true)
    expect([...nearby]).toEqual(['a'])
  })

  it('reports no change when nothing changes', () => {
    const nearby = new Set(['a'])
    expect(updateNearby(nearby, distances({ a: 10, b: 500 }))).toBe(false)
    expect([...nearby]).toEqual(['a'])
  })
})
