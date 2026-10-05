import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getMediaLocation } from '../../../types/Media'
import { assertValidMap } from '../../../types/map/validate'
import { findZone, officeMapInfo, type Zone } from '../../../types/OfficeMap'

// the media rooms of the real office map: which room I'm in decides whom I hear
const map = officeMapInfo(
  assertValidMap(
    JSON.parse(readFileSync(new URL('../../../assets/map/office.json', import.meta.url), 'utf8'))
  )
)
const zone = (type: string) => map.zones.find((z) => z.type === type)!
const center = (z: Zone) => ({ x: z.x + z.width / 2, y: z.y + z.height / 2 })

describe('media zones of the office map', () => {
  it('has the rooms the media rules rely on', () => {
    expect(map.zones.map((z) => z.type).sort()).toEqual(
      ['auditorium', 'meeting', 'quiet', 'stage'].sort()
    )
  })

  it('the library is a quiet zone: no media room at all', () => {
    const library = zone('quiet')
    expect(library.name).toBe('Library')
    const { x, y } = center(library)
    expect(getMediaLocation(map.zones, x, y)).toBeNull()
    // the whole library, up to its edges
    expect(getMediaLocation(map.zones, library.x, library.y)).toBeNull()
    expect(
      getMediaLocation(map.zones, library.x + library.width - 1, library.y + library.height - 1)
    ).toBeNull()
  })

  it('right outside the library is the open office again', () => {
    const library = zone('quiet')
    expect(getMediaLocation(map.zones, library.x + 10, library.y - 1)).toEqual({
      room: 'open',
      mode: 'proximity',
      canPublish: true,
    })
  })

  it('the open office (the spawn) uses proximity', () => {
    expect(getMediaLocation(map.zones, map.spawn.x, map.spawn.y)).toEqual({
      room: 'open',
      mode: 'proximity',
      canPublish: true,
    })
  })

  it('in the meeting room everyone hears everyone, and nobody outside', () => {
    const meeting = zone('meeting')
    const { x, y } = center(meeting)
    expect(getMediaLocation(map.zones, x, y)).toEqual({
      room: `zone-${meeting.id}`,
      mode: 'everyone',
      canPublish: true,
    })
  })

  it('the audience of the conference room listens, the stage speaks in the same room', () => {
    const hall = zone('auditorium')
    const stage = zone('stage')
    const seat = { x: hall.x + hall.width / 2, y: hall.y + hall.height - 10 }
    expect(findZone(map.zones, seat.x, seat.y)?.type).toBe('auditorium')
    expect(getMediaLocation(map.zones, seat.x, seat.y)).toEqual({
      room: `zone-${hall.id}`,
      mode: 'everyone',
      canPublish: false,
    })
    const { x, y } = center(stage)
    expect(getMediaLocation(map.zones, x, y)).toEqual({
      room: `zone-${hall.id}`,
      mode: 'everyone',
      canPublish: true,
    })
  })

  it('findZone picks the smallest zone containing the point', () => {
    const outer: Zone = {
      id: '1',
      name: 'a',
      type: 'auditorium',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }
    const inner: Zone = { id: '2', name: 'b', type: 'stage', x: 10, y: 10, width: 20, height: 20 }
    expect(findZone([outer, inner], 15, 15)?.id).toBe('2')
    expect(findZone([inner, outer], 15, 15)?.id).toBe('2')
    expect(findZone([outer, inner], 50, 50)?.id).toBe('1')
    // right/bottom edges are outside
    expect(findZone([outer], 100, 50)).toBeUndefined()
  })
})
