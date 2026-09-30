import { describe, expect, it } from 'vitest'
import {
  MAX_AVATAR_LENGTH,
  MAX_CHAT_LENGTH,
  MAX_NAME_LENGTH,
  sanitizeChatMessage,
  sanitizeName,
  validateAvatar,
  validateEmote,
  validatePlayerUpdate,
} from '../rooms/validation.ts'
import { DRINK_IDS, EMOTES } from '../../types/Emotes.ts'
import { PRESETS, randomAvatar } from '../../client-3d/src/avatar/avatar.ts'

describe('validateAvatar', () => {
  it('accepts what the client sends', () => {
    for (const avatar of [...Object.values(PRESETS), randomAvatar()]) {
      const json = JSON.stringify(avatar)
      expect(validateAvatar(json)).toBe(json)
    }
  })

  it('rejects everything that is not a JSON object', () => {
    for (const bad of [undefined, null, 42, {}, '', 'nope', '[1,2]', 'null', '"text"', '12']) {
      expect(validateAvatar(bad)).toBeNull()
    }
  })

  it('rejects oversized avatars', () => {
    const big = JSON.stringify({ skin: 'x'.repeat(MAX_AVATAR_LENGTH) })
    expect(validateAvatar(big)).toBeNull()
    const fits = JSON.stringify({ s: 'x'.repeat(MAX_AVATAR_LENGTH - 10) })
    expect(fits.length).toBeLessThanOrEqual(MAX_AVATAR_LENGTH)
    expect(validateAvatar(fits)).toBe(fits)
  })
})

describe('sanitizeChatMessage', () => {
  it('trims and keeps normal messages', () => {
    expect(sanitizeChatMessage('  Hallo 👋  ')).toBe('Hallo 👋')
  })

  it('drops empty and non-text messages', () => {
    for (const bad of ['', '   ', undefined, null, 5, { content: 'x' }, ['x']]) {
      expect(sanitizeChatMessage(bad)).toBeNull()
    }
  })

  it('cuts messages to the length of the chat input', () => {
    expect(sanitizeChatMessage('a'.repeat(5000))).toHaveLength(MAX_CHAT_LENGTH)
  })
})

describe('sanitizeName', () => {
  it('trims and cuts to the length of the name input', () => {
    expect(sanitizeName('  Ada  ')).toBe('Ada')
    expect(sanitizeName('x'.repeat(100))).toHaveLength(MAX_NAME_LENGTH)
  })

  it('ignores anything that is not text', () => {
    expect(sanitizeName(undefined)).toBeNull()
    expect(sanitizeName({ name: 'x' })).toBeNull()
  })
})

describe('validateEmote (whitelist)', () => {
  it('lets through the emotes and drinks of the client', () => {
    for (const emote of EMOTES) expect(validateEmote(emote)).toBe(emote)
    for (const drink of DRINK_IDS) expect(validateEmote(`drink:${drink}`)).toBe(`drink:${drink}`)
  })

  it('blocks everything else', () => {
    for (const bad of [
      '',
      'dance',
      'WAVE',
      'wave ',
      'drink',
      'drink:',
      'drink:beer',
      'drink:coffee:extra',
      'hop:coffee',
      '<script>',
      undefined,
      7,
    ]) {
      expect(validateEmote(bad)).toBeNull()
    }
  })
})

describe('validatePlayerUpdate', () => {
  it('accepts a position with anim and optional angle', () => {
    expect(validatePlayerUpdate({ x: 10, y: 20.5, anim: 'adam_run_left', rot: 1.2 })).toEqual({
      x: 10,
      y: 20.5,
      anim: 'adam_run_left',
      rot: 1.2,
    })
    expect(validatePlayerUpdate({ x: 1, y: 2, anim: 'ash_idle_down' })?.rot).toBeUndefined()
  })

  it('rejects broken positions and anims', () => {
    for (const bad of [
      null,
      'x',
      { x: NaN, y: 1, anim: 'a' },
      { x: 1, y: Infinity, anim: 'a' },
      { x: '1', y: 2, anim: 'a' },
      { x: 1, y: 2 },
      { x: 1, y: 2, anim: 'a'.repeat(65) },
    ]) {
      expect(validatePlayerUpdate(bad)).toBeNull()
    }
  })

  it('ignores an invalid angle but keeps the position', () => {
    expect(validatePlayerUpdate({ x: 1, y: 2, anim: 'a', rot: NaN })).toEqual({
      x: 1,
      y: 2,
      anim: 'a',
      rot: undefined,
    })
  })
})
