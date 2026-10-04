import type { RoomTarget } from '../net/network'
import type { LobbyRoom } from '../state/game'

// The steps of the join screen and what each needs before going on, without React,
// so the rules can be tested.

export const JOIN_STEPS = ['profile', 'room', 'media'] as const
export type JoinStep = (typeof JOIN_STEPS)[number]

export const STEP_LABELS: Record<JoinStep, string> = {
  profile: 'Profil',
  room: 'Raum',
  media: 'Kamera & Mikro',
}

export const NAME_MAX_LENGTH = 24

// 'public', the id of a custom room from the lobby, or 'new'
export type RoomChoice = string

export type RoomForm = {
  choice: RoomChoice
  // of the chosen custom room
  password: string
  newRoom: { name: string; description: string; password: string }
}

export const DEFAULT_ROOM_FORM: RoomForm = {
  choice: 'public',
  password: '',
  newRoom: { name: '', description: '', password: '' },
}

export type JoinForm = { name: string; room: RoomForm; rooms: LobbyRoom[] }

export function nameProblem(name: string): string | null {
  return name.trim() ? null : 'Bitte gib deinen Namen ein.'
}

export function roomProblem(room: RoomForm, rooms: LobbyRoom[]): string | null {
  if (room.choice === 'public') return null
  if (room.choice === 'new')
    return room.newRoom.name.trim() ? null : 'Bitte gib dem neuen Raum einen Namen.'
  const selected = rooms.find((r) => r.roomId === room.choice)
  if (!selected) return 'Dieser Raum ist nicht mehr verfügbar. Bitte wähle einen anderen.'
  if (selected.hasPassword && !room.password)
    return 'Dieser Raum ist geschützt. Bitte gib das Passwort ein.'
  return null
}

// what keeps the user from leaving the step, null if nothing
export function stepProblem(step: JoinStep, form: JoinForm): string | null {
  if (step === 'profile') return nameProblem(form.name)
  if (step === 'room') return roomProblem(form.room, form.rooms)
  return null
}

// a step can be opened once all steps before it are complete
export function canOpenStep(step: JoinStep, form: JoinForm) {
  const index = JOIN_STEPS.indexOf(step)
  return JOIN_STEPS.slice(0, index).every((before) => !stepProblem(before, form))
}

// checked again on Beitreten (e.g. the chosen room closed meanwhile): the first step
// that is not complete, to send the user back there
export function joinProblem(form: JoinForm): { step: JoinStep; message: string } | null {
  for (const step of JOIN_STEPS) {
    const message = stepProblem(step, form)
    if (message) return { step, message }
  }
  return null
}

// closing the advanced options goes back to the public office, so no hidden choice applies
export function setAdvanced(room: RoomForm, open: boolean): RoomForm {
  return open ? room : { ...room, choice: 'public', password: '' }
}

// picking another custom room forgets the password typed for the previous one
export function chooseRoom(room: RoomForm, choice: RoomChoice): RoomForm {
  return choice === room.choice ? room : { ...room, choice, password: '' }
}

export function nextStep(step: JoinStep): JoinStep | null {
  return JOIN_STEPS[JOIN_STEPS.indexOf(step) + 1] ?? null
}

export function previousStep(step: JoinStep): JoinStep | null {
  return JOIN_STEPS[JOIN_STEPS.indexOf(step) - 1] ?? null
}

// where Beitreten goes
export function roomTarget(room: RoomForm, rooms: LobbyRoom[]): RoomTarget {
  if (room.choice === 'new')
    return {
      kind: 'create',
      name: room.newRoom.name.trim(),
      description: room.newRoom.description.trim(),
      password: room.newRoom.password,
    }
  const selected = rooms.find((r) => r.roomId === room.choice)
  if (selected) return { kind: 'custom', roomId: selected.roomId, password: room.password }
  return { kind: 'public' }
}

// ---------- the room of the last visit ----------

// Only which room was joined is remembered ('public' or the id of a custom room),
// never a password; a room still being created ('new') is not a choice to restore.
const ROOM_KEY = 'skyoffice3d.room'
const ROOM_ID = /^[\w-]{1,64}$/

export function parseRoomChoice(value: string | null | undefined): RoomChoice {
  return value && value !== 'new' && ROOM_ID.test(value) ? value : 'public'
}

export function loadRoomChoice(): RoomChoice {
  try {
    return parseRoomChoice(localStorage.getItem(ROOM_KEY))
  } catch {
    return 'public'
  }
}

export function saveRoomChoice(choice: RoomChoice) {
  try {
    localStorage.setItem(ROOM_KEY, parseRoomChoice(choice))
  } catch {
    // private mode or full storage: the room just isn't remembered
  }
}

// the room form at the start: the remembered room, its password still to be typed
export function restoredRoomForm(saved: RoomChoice): RoomForm {
  return { ...DEFAULT_ROOM_FORM, choice: parseRoomChoice(saved) }
}

// A remembered custom room is only known once the room list is there: 'pending' until
// then, 'found' if it is still open, 'missing' if it closed or the list can't be loaded
// (the join screen then goes back to the public office and says so).
export function restoreStatus(
  saved: RoomChoice,
  lobby: 'idle' | 'loading' | 'ready' | 'error',
  rooms: LobbyRoom[]
): 'found' | 'pending' | 'missing' {
  if (saved === 'public' || saved === 'new') return 'found'
  if (lobby === 'idle' || lobby === 'loading') return 'pending'
  return rooms.some((r) => r.roomId === saved) ? 'found' : 'missing'
}

// While the remembered room is missing but still the choice, the form counts as the
// public office (with the advanced options closed) and `lost` says so; nothing has to be
// reset, and picking a room or opening the options makes the user's own choice.
export function restoredRoom(
  room: RoomForm,
  saved: RoomChoice,
  status: 'found' | 'pending' | 'missing'
): { room: RoomForm; lost: boolean } {
  const lost = status === 'missing' && room.choice === saved
  return { room: lost ? setAdvanced(room, false) : room, lost }
}

// the chosen room in words, for the summary on the join screen
export function describeRoom(room: RoomForm, rooms: LobbyRoom[]) {
  if (room.choice === 'public') return 'Öffentliches Büro'
  if (room.choice === 'new') {
    const name = room.newRoom.name.trim()
    return name ? `Neuer Raum „${name}“` : 'Neuer Raum'
  }
  return rooms.find((r) => r.roomId === room.choice)?.name ?? 'Raum nicht verfügbar'
}

// ---------- camera and microphone ----------

export type MediaChoice = { audioEnabled: boolean; videoEnabled: boolean }
export type MediaKind = 'audio' | 'video'

const MEDIA_KEY = { audio: 'audioEnabled', video: 'videoEnabled' } as const

// The preview only starts by itself for someone who joined with camera or microphone
// before (the media hook additionally checks that access was granted); on a first
// visit both are off until the user switches one on.
export function autoStartPreview(saved: MediaChoice) {
  return saved.audioEnabled || saved.videoEnabled
}

// switching the microphone or camera on the join screen: the change, whether the
// devices have to be requested for it and whether the preview can end (both off)
export function toggleMedia(
  choice: MediaChoice,
  kind: MediaKind,
  preview: { requested: boolean; hasStream: boolean }
) {
  const key = MEDIA_KEY[kind]
  const changes: Partial<MediaChoice> = { [key]: !choice[key] }
  const next = { ...choice, ...changes }
  const on = next.audioEnabled || next.videoEnabled
  return {
    changes,
    request: on && !preview.hasStream,
    stop: !on && preview.requested,
  }
}

// what Beitreten does with the preview: hand it over to the video chat, or join without
export function mediaOnJoin(choice: MediaChoice, hasStream: boolean): 'use' | 'none' {
  return hasStream && (choice.audioEnabled || choice.videoEnabled) ? 'use' : 'none'
}

// whether the choice is remembered for the next visit: yes if it is what the user
// joins with; not if camera or microphone were wanted but could not be used
export function rememberMediaChoice(choice: MediaChoice, hasStream: boolean) {
  return mediaOnJoin(choice, hasStream) === 'use' || (!choice.audioEnabled && !choice.videoEnabled)
}

// the text in the preview area when no camera picture is shown
export function previewMessage(preview: {
  requested: boolean
  hasStream: boolean
  error: string | null
  videoEnabled: boolean
  hasVideo: boolean
}) {
  if (!preview.requested) return 'Kamera und Mikrofon sind aus'
  if (preview.error) return 'Kein Zugriff auf Kamera oder Mikrofon'
  if (!preview.hasStream) return 'Warte auf Freigabe …'
  if (!preview.hasVideo) return 'Keine Kamera gefunden'
  return preview.videoEnabled ? 'Kamera startet …' : 'Kamera ist aus'
}

// what the user joins with, for the summary of the media step
export function describeMedia({ audioEnabled, videoEnabled }: MediaChoice) {
  if (audioEnabled && videoEnabled) return 'Du trittst mit Mikrofon und Kamera bei.'
  if (audioEnabled) return 'Du trittst mit Mikrofon bei, die Kamera bleibt aus.'
  if (videoEnabled) return 'Du trittst mit Kamera bei, das Mikrofon bleibt aus.'
  return 'Du trittst ohne Kamera und Mikrofon bei. Du kannst sie später im Büro einschalten.'
}
