import { Room, RoomEvent, Track } from 'livekit-client'
import type { MediaGrant, MediaTokenRequest } from '../../../types/Media'

// anything that can hand out LiveKit tokens (the 2D and the 3D network)
type GrantSource = { requestMediaGrant(request: MediaTokenRequest): Promise<MediaGrant | null> }

export type SharedScreen = { id: string; stream: MediaStream }

type Snapshot = {
  myStream?: MediaStream
  screens: SharedScreen[]
  error?: string
  // added in the 3D client: whether the LiveKit room is joined yet
  connected?: boolean
}

/**
 * Copied from the 2D client (client/src/web/ScreenShareSession.ts), only the type of the
 * network is loosened so it works with the 3D client's network as well.
 *
 * Screen sharing at a computer: everyone using the same computer joins one LiveKit room
 * and sees the screens shared there. Lives as long as the computer dialog is open.
 */
export default class ScreenShareSession {
  private room?: Room
  private closed = false
  private listeners = new Set<() => void>()
  private snapshot: Snapshot = { screens: [] }
  private streams = new Map<string, MediaStream>()

  constructor(
    private network: GrantSource,
    private computerId: string
  ) {}

  async open() {
    // (3D client) can be opened again after close(), e.g. when React StrictMode runs
    // the effect twice
    this.closed = false
    try {
      const grant = await this.network.requestMediaGrant({
        kind: 'computer',
        computerId: this.computerId,
      })
      if (this.closed) return
      if (!grant) {
        this.setSnapshot({ error: 'An diesem Ort gibt es keine Medien.' })
        return
      }

      const room = new Room({ dynacast: true })
      room
        .on(RoomEvent.TrackSubscribed, () => this.update())
        .on(RoomEvent.TrackUnsubscribed, () => this.update())
        .on(RoomEvent.ParticipantDisconnected, () => this.update())
      // fail fast without a LiveKit server instead of retrying for a long time
      await room.connect(grant.url, grant.token, { maxRetries: 0, websocketTimeout: 4000 })
      if (this.closed) return room.disconnect()
      this.room = room
      this.setSnapshot({ connected: true })
      this.update()
    } catch (error) {
      console.warn('Screen sharing unavailable', error)
      this.setSnapshot({
        error: 'Bildschirmfreigabe nicht verfügbar (kein LiveKit-Server erreichbar).',
      })
    }
  }

  async startScreenShare() {
    const room = this.room
    if (!room || this.snapshot.myStream) return

    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    // "Stop sharing" in the browser's own bar ends the video track
    stream.getVideoTracks()[0]?.addEventListener('ended', () => this.stopScreenShare())

    for (const track of stream.getTracks()) {
      await room.localParticipant.publishTrack(track, {
        source: track.kind === 'video' ? Track.Source.ScreenShare : Track.Source.ScreenShareAudio,
      })
    }
    this.setSnapshot({ myStream: stream })
  }

  async stopScreenShare() {
    const stream = this.snapshot.myStream
    if (!stream) return
    this.setSnapshot({ myStream: undefined })
    for (const track of stream.getTracks()) {
      await this.room?.localParticipant.unpublishTrack(track, false)
      track.stop()
    }
  }

  close() {
    this.closed = true
    this.snapshot.myStream?.getTracks().forEach((track) => track.stop())
    this.room?.disconnect()
    this.room = undefined
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.snapshot

  private update() {
    const screens: SharedScreen[] = []
    for (const participant of this.room?.remoteParticipants.values() ?? []) {
      const video = participant.getTrackPublication(Track.Source.ScreenShare)?.track
      if (!video) continue
      const audio = participant.getTrackPublication(Track.Source.ScreenShareAudio)?.track
      // reuse the stream while the tracks stay the same, so the video element isn't reset
      const key = `${video.sid}:${audio?.sid ?? ''}`
      let stream = this.streams.get(key)
      if (!stream) {
        stream = new MediaStream([
          video.mediaStreamTrack,
          ...(audio ? [audio.mediaStreamTrack] : []),
        ])
        this.streams.set(key, stream)
      }
      screens.push({ id: participant.identity, stream })
    }
    this.setSnapshot({ screens })
  }

  private setSnapshot(changes: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...changes }
    this.listeners.forEach((listener) => listener())
  }
}
