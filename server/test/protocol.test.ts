import { describe, expect, it } from 'vitest'
import { Message } from '../../types/Messages.ts'
import { officeMap } from '../officeMap.ts'

describe('Message numbers', () => {
  // they go over the wire and are hard-coded in client-3d/scripts/bots.mjs;
  // removed messages leave a gap, numbers are never reused
  it('stay the same', () => {
    expect({ ...Message }).toMatchObject({
      UPDATE_PLAYER: 0,
      UPDATE_PLAYER_NAME: 1,
      CONNECT_TO_COMPUTER: 2,
      DISCONNECT_FROM_COMPUTER: 3,
      ADD_CHAT_MESSAGE: 6,
      SEND_ROOM_DATA: 7,
      REQUEST_MEDIA_TOKEN: 13,
      UPDATE_PLAYER_AVATAR: 14,
      PLAYER_EMOTE: 15,
      PLAYER_HAND: 16,
    })
  })

  it('have no duplicates', () => {
    const numbers = Object.values(Message).filter((v) => typeof v === 'number')
    expect(new Set(numbers).size).toBe(numbers.length)
  })
})

describe('officeMap (read from assets/map/map.json at start)', () => {
  it('has the computers, the spawn and the zones', () => {
    expect(officeMap.computerIds.length).toBeGreaterThan(0)
    expect(new Set(officeMap.computerIds).size).toBe(officeMap.computerIds.length)
    expect(officeMap.spawn).toEqual({ x: 1153, y: 500 })
    expect(officeMap.zones.map((z) => z.name)).toContain('Library')
  })
})
