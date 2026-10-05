import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ROOM_FORM,
  autoStartPreview,
  canOpenStep,
  chooseRoom,
  describeMedia,
  describeRoom,
  joinProblem,
  loadRoomChoice,
  mediaOnJoin,
  nextStep,
  previewMessage,
  previousStep,
  parseRoomChoice,
  rememberMediaChoice,
  restoreStatus,
  restoredRoom,
  restoredRoomForm,
  roomTarget,
  saveRoomChoice,
  setAdvanced,
  stepProblem,
  toggleMedia,
  type JoinForm,
  type RoomForm,
} from '../src/ui/joinFlow'
import type { LobbyRoom } from '../src/state/game'
import { memoryStorage } from '../../packages/media/test/storage'

const open: LobbyRoom = {
  roomId: 'open1',
  name: 'Team Blau',
  description: '',
  hasPassword: false,
  clients: 2,
}
const locked: LobbyRoom = { ...open, roomId: 'locked1', name: 'Geheim', hasPassword: true }
const rooms = [open, locked]

const room = (patch: Partial<RoomForm>): RoomForm => ({ ...DEFAULT_ROOM_FORM, ...patch })
const form = (patch: Partial<JoinForm> = {}): JoinForm => ({
  name: 'Ada',
  room: DEFAULT_ROOM_FORM,
  rooms,
  ...patch,
})

describe('steps', () => {
  it('go profile, room, media and back', () => {
    expect(nextStep('profile')).toBe('room')
    expect(nextStep('room')).toBe('media')
    expect(nextStep('media')).toBeNull()
    expect(previousStep('media')).toBe('room')
    expect(previousStep('profile')).toBeNull()
  })

  it('need a name before going on', () => {
    expect(stepProblem('profile', form({ name: '   ' }))).toMatch(/Namen/)
    expect(stepProblem('profile', form())).toBeNull()
    expect(canOpenStep('room', form({ name: '' }))).toBe(false)
    expect(canOpenStep('media', form({ name: '' }))).toBe(false)
    expect(canOpenStep('profile', form({ name: '' }))).toBe(true)
  })

  it('open the media step only with a complete room choice', () => {
    expect(canOpenStep('media', form())).toBe(true)
    expect(canOpenStep('media', form({ room: room({ choice: 'new' }) }))).toBe(false)
  })

  it('the media step never blocks joining', () => {
    expect(stepProblem('media', form())).toBeNull()
  })
})

describe('room choice', () => {
  it('is the public office by default', () => {
    expect(stepProblem('room', form())).toBeNull()
    expect(roomTarget(DEFAULT_ROOM_FORM, rooms)).toEqual({ kind: 'public' })
    expect(describeRoom(DEFAULT_ROOM_FORM, rooms)).toBe('Öffentliches Büro')
  })

  it('a new room needs a name; name and description are trimmed', () => {
    const empty = room({ choice: 'new' })
    expect(stepProblem('room', form({ room: empty }))).toMatch(/Namen/)
    const filled = room({
      choice: 'new',
      newRoom: { name: '  Lounge ', description: ' Kaffee ', password: ' pw' },
    })
    expect(stepProblem('room', form({ room: filled }))).toBeNull()
    expect(roomTarget(filled, rooms)).toEqual({
      kind: 'create',
      name: 'Lounge',
      description: 'Kaffee',
      password: ' pw',
    })
    expect(describeRoom(filled, rooms)).toBe('Neuer Raum „Lounge“')
  })

  it('a protected room needs its password', () => {
    expect(stepProblem('room', form({ room: room({ choice: 'locked1' }) }))).toMatch(/Passwort/)
    const withPassword = room({ choice: 'locked1', password: 'geheim' })
    expect(stepProblem('room', form({ room: withPassword }))).toBeNull()
    expect(roomTarget(withPassword, rooms)).toEqual({
      kind: 'custom',
      roomId: 'locked1',
      password: 'geheim',
    })
  })

  it('an open custom room needs nothing else', () => {
    const choice = room({ choice: 'open1' })
    expect(stepProblem('room', form({ room: choice }))).toBeNull()
    expect(describeRoom(choice, rooms)).toBe('Team Blau')
  })

  it('a room that closed meanwhile is a problem, not silently the public office', () => {
    const gone = form({ room: room({ choice: 'open1' }), rooms: [locked] })
    expect(stepProblem('room', gone)).toMatch(/nicht mehr verfügbar/)
    expect(joinProblem(gone)).toEqual({ step: 'room', message: expect.any(String) })
  })

  it('choosing another room forgets the password of the previous one', () => {
    const typed = room({ choice: 'locked1', password: 'geheim' })
    expect(chooseRoom(typed, 'locked1')).toBe(typed)
    expect(chooseRoom(typed, 'open1')).toEqual(room({ choice: 'open1' }))
  })

  it('closing the advanced options goes back to the public office', () => {
    const custom = room({ choice: 'locked1', password: 'geheim' })
    expect(setAdvanced(custom, true)).toBe(custom)
    expect(setAdvanced(custom, false)).toEqual(room({ choice: 'public' }))
    // what was typed for a new room stays, for when the options are opened again
    const draft = room({ choice: 'new', newRoom: { name: 'X', description: '', password: '' } })
    expect(setAdvanced(draft, false).newRoom.name).toBe('X')
  })
})

describe('joinProblem (checked again on Beitreten)', () => {
  it('is null for a complete form', () => {
    expect(joinProblem(form())).toBeNull()
  })

  it('points to the first incomplete step', () => {
    expect(joinProblem(form({ name: '', room: room({ choice: 'new' }) }))?.step).toBe('profile')
    expect(joinProblem(form({ room: room({ choice: 'new' }) }))?.step).toBe('room')
  })
})

describe('camera and microphone', () => {
  const off = { audioEnabled: false, videoEnabled: false }
  const idle = { requested: false, hasStream: false }

  it('the preview starts by itself only for someone who used them before', () => {
    expect(autoStartPreview(off)).toBe(false)
    expect(autoStartPreview({ audioEnabled: true, videoEnabled: false })).toBe(true)
    expect(autoStartPreview({ audioEnabled: false, videoEnabled: true })).toBe(true)
  })

  it('switching one on for the first time asks for the devices', () => {
    expect(toggleMedia(off, 'audio', idle)).toEqual({
      changes: { audioEnabled: true },
      request: true,
      stop: false,
    })
    expect(toggleMedia(off, 'video', idle)).toEqual({
      changes: { videoEnabled: true },
      request: true,
      stop: false,
    })
  })

  it('with a running preview switching only mutes or unmutes', () => {
    const both = { audioEnabled: true, videoEnabled: true }
    const running = { requested: true, hasStream: true }
    expect(toggleMedia(both, 'video', running)).toEqual({
      changes: { videoEnabled: false },
      request: false,
      stop: false,
    })
    expect(toggleMedia({ audioEnabled: true, videoEnabled: false }, 'video', running).request).toBe(
      false
    )
  })

  it('switching the last one off ends the preview', () => {
    const micOnly = { audioEnabled: true, videoEnabled: false }
    expect(toggleMedia(micOnly, 'audio', { requested: true, hasStream: true })).toEqual({
      changes: { audioEnabled: false },
      request: false,
      stop: true,
    })
    // nothing to end if it never started
    expect(toggleMedia(micOnly, 'audio', idle).stop).toBe(false)
  })

  it('after a failed request switching on asks again', () => {
    expect(toggleMedia(off, 'video', { requested: true, hasStream: false }).request).toBe(true)
  })

  it('a remembered choice that looks on but was never granted just asks, without turning off', () => {
    const micOnly = { audioEnabled: true, videoEnabled: false }
    expect(toggleMedia(micOnly, 'audio', idle)).toEqual({
      changes: {},
      request: true,
      stop: false,
    })
    // still true once a stream exists: now it really toggles off
    expect(toggleMedia(micOnly, 'audio', { requested: true, hasStream: true })).toEqual({
      changes: { audioEnabled: false },
      request: false,
      stop: true,
    })
    // the other, genuinely off switch still turns on and asks
    expect(toggleMedia(micOnly, 'video', idle)).toEqual({
      changes: { videoEnabled: true },
      request: true,
      stop: false,
    })
  })

  it('with a pending request, clicking toggles off and does not re-request', () => {
    const micOnly = { audioEnabled: true, videoEnabled: false }
    const pendingRequest = { requested: true, hasStream: false }
    expect(toggleMedia(micOnly, 'audio', pendingRequest)).toEqual({
      changes: { audioEnabled: false },
      request: false,
      stop: true,
    })
  })

  it('joins with the preview only if something is switched on and there is a stream', () => {
    const mic = { audioEnabled: true, videoEnabled: false }
    expect(mediaOnJoin(mic, true)).toBe('use')
    expect(mediaOnJoin(mic, false)).toBe('none')
    expect(mediaOnJoin(off, true)).toBe('none')
    expect(mediaOnJoin(off, false)).toBe('none')
  })

  it('remembers what the user joins with, but not a wish that could not be met', () => {
    const cam = { audioEnabled: false, videoEnabled: true }
    expect(rememberMediaChoice(cam, true)).toBe(true)
    expect(rememberMediaChoice(off, false)).toBe(true)
    expect(rememberMediaChoice(off, true)).toBe(true)
    // camera wanted, but access was denied: keep the earlier choice
    expect(rememberMediaChoice(cam, false)).toBe(false)
  })

  it('tells what the preview area is waiting for', () => {
    const base = { requested: true, hasStream: true, error: null, videoEnabled: true }
    expect(previewMessage({ ...base, requested: false, hasStream: false, hasVideo: false })).toBe(
      'Kamera und Mikrofon sind aus'
    )
    expect(previewMessage({ ...base, hasStream: false, hasVideo: false })).toMatch(/Freigabe/)
    expect(previewMessage({ ...base, hasStream: false, error: 'x', hasVideo: false })).toMatch(
      /Kein Zugriff/
    )
    expect(previewMessage({ ...base, hasVideo: false })).toBe('Keine Kamera gefunden')
    expect(previewMessage({ ...base, videoEnabled: false, hasVideo: true })).toBe('Kamera ist aus')
  })

  it('describes what the user joins with', () => {
    expect(describeMedia(off)).toMatch(/ohne Kamera und Mikrofon/)
    expect(describeMedia({ audioEnabled: true, videoEnabled: true })).toMatch(/Mikrofon und Kamera/)
    expect(describeMedia({ audioEnabled: true, videoEnabled: false })).toMatch(/Kamera bleibt aus/)
    expect(describeMedia({ audioEnabled: false, videoEnabled: true })).toMatch(
      /Mikrofon bleibt aus/
    )
  })
})

describe('room of the last visit', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('remembers only the room, never a password', () => {
    expect(loadRoomChoice()).toBe('public')
    saveRoomChoice('locked1')
    expect(loadRoomChoice()).toBe('locked1')
    expect(localStorage.getItem('skyoffice3d.room')).toBe('locked1')
    expect(restoredRoomForm(loadRoomChoice())).toEqual(room({ choice: 'locked1' }))
    expect(restoredRoomForm('locked1').password).toBe('')
  })

  it('does not restore a room still to be created or a broken value', () => {
    expect(parseRoomChoice('new')).toBe('public')
    expect(parseRoomChoice('')).toBe('public')
    expect(parseRoomChoice(null)).toBe('public')
    expect(parseRoomChoice('{"x":1}')).toBe('public')
    saveRoomChoice('new')
    expect(loadRoomChoice()).toBe('public')
  })

  it('survives blocked storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
    })
    expect(() => saveRoomChoice('open1')).not.toThrow()
    expect(loadRoomChoice()).toBe('public')
  })

  it('waits for the room list to find a remembered custom room again', () => {
    expect(restoreStatus('public', 'idle', [])).toBe('found')
    expect(restoreStatus('open1', 'idle', [])).toBe('pending')
    expect(restoreStatus('open1', 'loading', [])).toBe('pending')
    expect(restoreStatus('open1', 'ready', rooms)).toBe('found')
    expect(restoreStatus('gone1', 'ready', rooms)).toBe('missing')
    expect(restoreStatus('open1', 'error', [])).toBe('missing')
  })

  it('falls back to the public office while a missing remembered room is still chosen', () => {
    const remembered = restoredRoomForm('gone1')
    expect(restoredRoom(remembered, 'gone1', 'pending')).toEqual({ room: remembered, lost: false })
    expect(restoredRoom(remembered, 'gone1', 'found')).toEqual({ room: remembered, lost: false })
    expect(restoredRoom(remembered, 'gone1', 'missing')).toEqual({
      room: room({ choice: 'public' }),
      lost: true,
    })
    // something the user picked meanwhile stays
    const picked = room({ choice: 'new', newRoom: { name: 'X', description: '', password: '' } })
    expect(restoredRoom(picked, 'gone1', 'missing')).toEqual({ room: picked, lost: false })
  })
})
