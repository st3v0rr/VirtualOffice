import { create } from 'zustand'
import type { Avatar } from '../avatar/avatar'
import { loadAvatar, DEFAULT_AVATAR } from '../avatar/avatar'
import { loadMediaSettings } from '@skyoffice/media'

// React state of the 3D client. Positions are NOT in here: they change every frame and
// live in mutable objects (see net/players.ts) that the scene reads in useFrame.

export type ChatLine = { author: string; content: string; createdAt: number; system?: boolean }
export type Bubble = { text: string; until: number }
export type Dialog =
  // minimized: closed, but still at the computer (the shared screen shows on its monitor)
  { kind: 'computer'; id: string; minimized?: boolean } | { kind: 'vending' } | null

// a custom room from the lobby
export type LobbyRoom = {
  roomId: string
  name: string
  description: string
  hasPassword: boolean
  clients: number
}

type GameState = {
  connection: 'offline' | 'connecting' | 'connected' | 'error'
  connectionError?: string
  sessionId?: string
  name: string
  avatar: Avatar
  hasSavedAvatar: boolean
  // id -> name / avatar of the other players, only changes when someone joins,
  // leaves, renames or changes clothes
  players: Record<string, { name: string; avatar: Avatar }>
  rooms: LobbyRoom[]
  // the room list is only loaded when the join screen asks for it
  lobby: 'idle' | 'loading' | 'ready' | 'error'
  roomName: string
  chat: ChatLine[]
  bubbles: Record<string, Bubble>
  editorOpen: boolean
  chatFocused: boolean
  dialog: Dialog
  // hint for the item in front of me, e.g. "E: Hinsetzen"
  prompt: string | null
  // video chat (see media/media.ts): my camera/microphone stream is set up
  videoConnected: boolean
  // state of my own microphone/camera track, null if there is no such device
  microphone: boolean | null
  camera: boolean | null
  // I'm in a quiet zone (library): no audio/video there
  quietZone: boolean
  // speaker for the voices of the others ('' = system default)
  audioOutputId: string
  mediaSetupOpen: boolean
  // the screen shared at a computer I'm using, shown on its monitors, by computer id
  screens: Record<string, MediaStream>
  // players using a computer, by computer id
  itemUsers: Record<string, string[]>
  set: (patch: Partial<Omit<GameState, 'set'>>) => void
}

const saved = loadAvatar()

export const useGame = create<GameState>()((set) => ({
  connection: 'offline',
  name: localStorage.getItem('skyoffice3d.name') ?? '',
  avatar: saved ?? DEFAULT_AVATAR,
  hasSavedAvatar: saved !== null,
  players: {},
  rooms: [],
  lobby: 'idle',
  roomName: '',
  chat: [],
  bubbles: {},
  editorOpen: false,
  chatFocused: false,
  dialog: null,
  prompt: null,
  videoConnected: false,
  microphone: null,
  camera: null,
  quietZone: false,
  audioOutputId: loadMediaSettings().audioOutputId,
  mediaSetupOpen: false,
  screens: {},
  itemUsers: {},
  set: (patch) => set(patch),
}))

export const BUBBLE_DURATION = 6000

export function showBubble(playerId: string, text: string) {
  const content = text.length <= 70 ? text : `${text.slice(0, 70)}…`
  useGame.setState((s) => ({
    bubbles: { ...s.bubbles, [playerId]: { text: content, until: Date.now() + BUBBLE_DURATION } },
  }))
}

export function pushChat(line: ChatLine) {
  useGame.setState((s) => ({ chat: [...s.chat.slice(-99), line] }))
}
