import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_AVATAR,
  PRESETS,
  avatarForTexture,
  loadAvatar,
  parseAvatar,
  randomAvatar,
  sanitizeAvatar,
  saveAvatar,
} from '../src/avatar/avatar'
import { angleToDirection, parseAnim, toAnim } from '../src/net/players'
import { memoryStorage } from '../../packages/media/test/storage'

describe('avatar serialization', () => {
  it('survives the round trip through JSON (as synced to the others)', () => {
    for (const avatar of [...Object.values(PRESETS), randomAvatar(), randomAvatar()]) {
      expect(parseAvatar(JSON.stringify(avatar))).toEqual(avatar)
    }
  })

  it('stays small enough for the server (1000 characters)', () => {
    const longest = JSON.stringify({ ...PRESETS.nancy, hair: 'pigtails', top: 'sweater' })
    expect(longest.length).toBeLessThan(300)
  })

  it('replaces unknown parts and colours with the defaults, keeps the valid ones', () => {
    const avatar = sanitizeAvatar({
      skin: 'red',
      hair: 'mohawk',
      hairColor: '#123abc',
      top: 'hoodie',
      topColor: '#12345', // too short
      bottom: '<img>',
      bottomColor: '#ABCDEF',
      texture: 'gandalf',
      extra: 'ignored',
    })
    expect(avatar).toEqual({
      ...DEFAULT_AVATAR,
      hairColor: '#123abc',
      top: 'hoodie',
      bottomColor: '#ABCDEF',
    })
    expect(avatar).not.toHaveProperty('extra')
  })

  it('turns garbage into the default avatar or null', () => {
    expect(sanitizeAvatar(null)).toEqual(DEFAULT_AVATAR)
    expect(sanitizeAvatar('adam')).toEqual(DEFAULT_AVATAR)
    expect(parseAvatar('{broken')).toBeNull()
    expect(parseAvatar('')).toBeNull()
    expect(parseAvatar(undefined)).toBeNull()
    expect(parseAvatar('[]')).toEqual(DEFAULT_AVATAR)
  })

  it('shows players without avatar as the preset of their texture', () => {
    expect(avatarForTexture('lucy')).toBe(PRESETS.lucy)
    expect(avatarForTexture('unknown')).toBe(DEFAULT_AVATAR)
    expect(avatarForTexture(undefined)).toBe(DEFAULT_AVATAR)
  })
})

describe('avatar persistence', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('remembers the saved avatar', () => {
    expect(loadAvatar()).toBeNull()
    saveAvatar(PRESETS.ash)
    expect(loadAvatar()).toEqual(PRESETS.ash)
  })

  it('sanitizes what it loads (older versions, hand edits)', () => {
    localStorage.setItem('skyoffice3d.avatar', JSON.stringify({ ...PRESETS.ash, hair: 'mullet' }))
    expect(loadAvatar()).toEqual({ ...PRESETS.ash, hair: DEFAULT_AVATAR.hair })
  })

  it('survives broken or missing storage', () => {
    localStorage.setItem('skyoffice3d.avatar', 'nope')
    expect(loadAvatar()).toBeNull()
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
    })
    expect(() => saveAvatar(PRESETS.adam)).not.toThrow()
    expect(loadAvatar()).toBeNull()
  })
})

describe('anim keys ("lucy_run_left", the position format on the wire)', () => {
  it('round trips state and direction', () => {
    expect(toAnim('lucy', 'walk', 0)).toBe('lucy_run_down')
    expect(parseAnim('lucy_run_down')).toEqual({ texture: 'lucy', state: 'walk', dir: 'down' })
    expect(parseAnim(toAnim('ash', 'sit', 0, 'left'))).toEqual({
      texture: 'ash',
      state: 'sit',
      dir: 'left',
    })
    expect(parseAnim(toAnim('adam', 'idle', Math.PI))).toEqual({
      texture: 'adam',
      state: 'idle',
      dir: 'up',
    })
  })

  it('maps any angle to the nearest of the four directions', () => {
    expect(angleToDirection(0)).toBe('down')
    expect(angleToDirection(Math.PI / 2)).toBe('right')
    expect(angleToDirection(-Math.PI / 2)).toBe('left')
    expect(angleToDirection(Math.PI)).toBe('up')
    expect(angleToDirection(-Math.PI)).toBe('up')
    expect(angleToDirection(2 * Math.PI + 0.1)).toBe('down')
    expect(angleToDirection(Math.PI / 4 + 0.01)).toBe('right')
  })

  it('treats unknown anims as standing, facing down', () => {
    expect(parseAnim('weird')).toEqual({ texture: 'weird', state: 'idle', dir: 'down' })
  })
})
