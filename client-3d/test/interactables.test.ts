import { afterEach, describe, expect, it } from 'vitest'
import { chairOccupant, chairs, findNearby } from '../src/game/interactables'
import { me, remotes, type RemoteState } from '../src/net/players'

const chair = chairs[0]
const remote = (patch: Partial<RemoteState>): RemoteState => ({
  targetX: 0,
  targetZ: 0,
  rot: 0,
  state: 'idle',
  fresh: false,
  emote: null,
  drink: null,
  ...patch,
})

afterEach(() => {
  remotes.clear()
  me.sittingOn = null
})

describe('chairOccupant (derived from positions, nothing stored on the server)', () => {
  it('a free chair has no occupant', () => {
    expect(chairOccupant(chair.id)).toBeNull()
  })

  it('someone sitting on the seat occupies it', () => {
    remotes.set('bob', remote({ targetX: chair.x + 0.2, targetZ: chair.z - 0.2, state: 'sit' }))
    expect(chairOccupant(chair.id)).toBe('bob')
  })

  it('standing on the seat or sitting next to it does not count', () => {
    remotes.set('walker', remote({ targetX: chair.x, targetZ: chair.z, state: 'walk' }))
    remotes.set('neighbour', remote({ targetX: chair.x + 0.5, targetZ: chair.z, state: 'sit' }))
    expect(chairOccupant(chair.id)).toBeNull()
  })

  it('my own chair is taken by me', () => {
    me.sittingOn = chair.id
    expect(chairOccupant(chair.id)).toBe('me')
  })

  it('unknown chairs have no occupant', () => {
    expect(chairOccupant('does-not-exist')).toBeNull()
  })
})

describe('findNearby', () => {
  it('offers the free chair I stand at', () => {
    expect(findNearby(chair.x, chair.z, chair.rot, false)).toMatchObject({
      kind: 'chair',
      id: chair.id,
    })
  })

  it('skips a chair someone sits on', () => {
    remotes.set('bob', remote({ targetX: chair.x, targetZ: chair.z, state: 'sit' }))
    expect(findNearby(chair.x, chair.z, chair.rot, false)?.id).not.toBe(chair.id)
  })

  it('offers no other chair while sitting', () => {
    expect(findNearby(chair.x, chair.z, chair.rot, true)?.kind).not.toBe('chair')
  })
})
