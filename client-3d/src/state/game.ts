import { create } from 'zustand'
import type { Avatar } from '../avatar/avatar'
import { loadAvatar, DEFAULT_AVATAR } from '../avatar/avatar'

// React state of the 3D client. Positions are NOT in here: they change every frame and
// live in mutable objects (see net/players.ts) that the scene reads in useFrame.

export type ChatLine = { author: string; content: string; createdAt: number; system?: boolean }
export type Bubble = { text: string; until: number }
export type Dialog =
  { kind: 'computer'; id: string } | { kind: 'whiteboard'; id: string } | { kind: 'vending' } | null

// a custom room from the lobby
export type LobbyRoom = {
  roomId: string
  name: string
  description: string
  hasPassword: boolean
  clients: number
}

export type MediaStatus = 'unknown' | 'checking' | 'available' | 'unavailable' | 'quiet'

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
  roomName: string
  chat: ChatLine[]
  bubbles: Record<string, Bubble>
  editorOpen: boolean
  chatFocused: boolean
  dialog: Dialog
  // hint for the item in front of me, e.g. "E: Hinsetzen"
  prompt: string | null
  media: MediaStatus
  mediaDetail?: string
  // players using a computer / whiteboard, by item id
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
  roomName: '',
  chat: [],
  bubbles: {},
  editorOpen: false,
  chatFocused: false,
  dialog: null,
  prompt: null,
  media: 'unknown',
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
