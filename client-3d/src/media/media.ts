import { useSyncExternalStore } from 'react'
import {
  MEDIA_UPDATE_INTERVAL,
  MediaManager,
  type MediaSettings,
  type MediaStatus,
  type MediaTile,
} from '@skyoffice/media'
import { getMediaLocation } from '../../../types/Media'
import type { Zone, ZoneType } from '../../../types/OfficeMap'
import { office, TILE, toMap } from '../map/office'
import { remotes } from '../net/players'
import { network } from '../net/network'
import { useGame } from '../state/game'

// Video and audio in the 3D client: the MediaManager of the 2D client (packages/media)
// fed with the same zones, distances and update rate, so both clients agree on who
// hears whom. Positions are in map pixels, as the server and the 2D client use them.

// the zones of the Tiled map in pixels (the extractor stores them in tiles)
const zones: Zone[] = office.zones.map((zone) => ({
  id: zone.id,
  name: zone.name,
  type: zone.type as ZoneType,
  x: zone.x * TILE,
  y: zone.y * TILE,
  width: zone.w * TILE,
  height: zone.h * TILE,
}))

let manager: MediaManager | null = null
let timer: number | undefined
// my camera/microphone, kept to hand it to a new manager after reconnecting
let myMedia: { stream: MediaStream; settings: MediaSettings } | null = null
let unsubscribeManager: (() => void) | undefined
// React components listen here; this relays the changes of whichever manager is current
const listeners = new Set<() => void>()

type Snapshot = ReturnType<MediaManager['getSnapshot']>
const OFF: Snapshot = { tiles: [], status: 'off', canPublish: false }

function notify() {
  listeners.forEach((listener) => listener())
}

// called after joining an office room
export function startMedia(sessionId: string) {
  stopMedia()
  const set = useGame.getState().set
  manager = new MediaManager(network, sessionId, {
    onVideoConnected: (videoConnected) => set({ videoConnected }),
    onTrackStateChange: (microphone, camera) => set({ microphone, camera }),
    // without a LiveKit server fail within seconds (the manager retries every 10 s)
    connectOptions: { maxRetries: 0, websocketTimeout: 4000 },
  })
  unsubscribeManager = manager.subscribe(notify)
  if (myMedia) manager.useMediaStream(myMedia.stream, myMedia.settings)
  timer = window.setInterval(updateLocation, MEDIA_UPDATE_INTERVAL)
  notify()
}

// leave the video chat, e.g. when the connection to the office is lost
export function stopMedia() {
  window.clearInterval(timer)
  unsubscribeManager?.()
  // leaves the LiveKit room
  manager?.updateLocation(null, new Map())
  manager = null
}

// like Game.updateMediaLocation in the 2D client
function updateLocation() {
  const game = useGame.getState()
  const position = network.position
  if (!manager || game.connection !== 'connected' || !position) return

  const { x, y } = position
  const distances = new Map<string, number>()
  for (const [id, remote] of remotes) {
    const other = toMap(remote.targetX, remote.targetZ)
    distances.set(id, Math.hypot(other.x - x, other.y - y))
  }
  const location = getMediaLocation(zones, x, y)
  manager.updateLocation(location, distances)
  const quietZone = location === null
  if (quietZone !== game.quietZone) game.set({ quietZone })
}

// use the camera/microphone stream from the setup dialog (first time or new devices)
export function setMyMedia(stream: MediaStream, settings: MediaSettings) {
  const first = !myMedia
  myMedia = { stream, settings }
  if (!manager) return
  if (first) manager.useMediaStream(stream, settings)
  else manager.replaceMediaStream(stream, settings)
}

export function setMicrophoneEnabled(enabled: boolean) {
  manager?.setMicrophoneEnabled(enabled)
}

export function setCameraEnabled(enabled: boolean) {
  manager?.setCameraEnabled(enabled)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

const getSnapshot = () => manager?.getSnapshot() ?? OFF

// the video tiles and the connection state, for React
export function useMedia() {
  return useSyncExternalStore(subscribe, getSnapshot)
}

// what a player's name tag shows: talking right now, muted, or nothing
export type VoiceState = 'speaking' | 'muted' | null

export function voiceState(tiles: MediaTile[], id: string): VoiceState {
  const tile = tiles.find((t) => t.id === id)
  // only people I can actually hear (and myself) light up
  if (!tile || (!tile.isLocal && !tile.audioStream)) return null
  if (tile.audioMuted) return 'muted'
  return tile.speaking ? 'speaking' : null
}

export function useVoiceState(id: string) {
  return useSyncExternalStore(subscribe, () => voiceState(getSnapshot().tiles, id))
}

export type { MediaStatus, MediaTile }
