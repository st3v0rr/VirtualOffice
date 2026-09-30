import {
  Room,
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type RoomConnectOptions,
} from 'livekit-client'

import type { MediaGrant, MediaLocation, MediaTokenRequest } from '../../../types/Media'
import {
  type MediaSettings,
  applyTrackSettings,
  getMediaStream,
  loadMediaSettings,
} from './mediaDevices'

// in the open office, start listening to someone closer than NEAR and stop beyond FAR
// (the gap avoids flickering connections at the edge); distances in map pixels
export const NEAR_DISTANCE = 110
export const FAR_DISTANCE = 170
// how often the game reports my location and the distances (see updateLocation)
export const MEDIA_UPDATE_INTERVAL = 250 // ms
// wait before connecting again when the video chat server was not reachable
const RETRY_DELAY = 10_000 // ms

export type MediaTile = {
  id: string
  name: string
  isLocal: boolean
  videoStream?: MediaStream
  audioStream?: MediaStream
  videoMuted: boolean
  audioMuted: boolean
  speaking: boolean
}

export type MediaStatus = 'off' | 'connecting' | 'connected' | 'unavailable'

type Snapshot = { tiles: MediaTile[]; status: MediaStatus; canPublish: boolean }

// anything that can hand out LiveKit tokens (the network of the 2D and the 3D client)
export type GrantSource = {
  requestMediaGrant(request: MediaTokenRequest): Promise<MediaGrant | null>
}

// how a client plugs the manager into its own state
export type MediaManagerOptions = {
  // my camera/microphone stream is acquired (true) and in use for video chat
  onVideoConnected?: (connected: boolean) => void
  // state of my own microphone/camera track, null if there is no such device
  onTrackStateChange?: (microphone: boolean | null, camera: boolean | null) => void
  // passed to LiveKit's Room.connect, e.g. to fail fast without a server
  connectOptions?: RoomConnectOptions
}

/**
 * Video chat via LiveKit. The office is split into media rooms (see getMediaLocation):
 * the open space where you hear people close by, and private rooms per zone.
 * Walking into another zone switches the LiveKit room.
 */
export default class MediaManager {
  private myStream?: MediaStream
  private room?: Room
  private location: MediaLocation | null = null
  private locationKey?: string
  private nearby = new Set<string>()
  private speaking = new Set<string>()
  private streamCache = new Map<string, MediaStream>()
  // room switches run one after another
  private queue: Promise<void> = Promise.resolve()
  private listeners = new Set<() => void>()
  private snapshot: Snapshot = { tiles: [], status: 'off', canPublish: false }

  constructor(
    private network: GrantSource,
    private mySessionId: string,
    private options: MediaManagerOptions = {}
  ) {}

  // --- my camera and microphone ---

  // request camera and microphone with the devices chosen on the join screen
  getUserMedia(alertOnError = true) {
    const settings = loadMediaSettings()
    getMediaStream(settings)
      .then((stream) => this.useMediaStream(stream, settings))
      .catch(() => {
        if (alertOnError) window.alert('No webcam or microphone found, or permission is blocked')
      })
  }

  // use an already acquired stream (e.g. the preview from the join screen) for video chat
  useMediaStream(stream: MediaStream, settings: MediaSettings) {
    applyTrackSettings(stream, settings)
    this.myStream = stream
    this.options.onVideoConnected?.(true)
    this.syncTrackState()
    this.enqueue(() => this.publishMyTracks())
  }

  // switch to a new camera/microphone stream, e.g. from the settings dialog
  replaceMediaStream(stream: MediaStream, settings: MediaSettings) {
    const oldStream = this.myStream
    if (!oldStream) return this.useMediaStream(stream, settings)

    applyTrackSettings(stream, settings)
    this.myStream = stream
    this.enqueue(async () => {
      await this.unpublishTracks(oldStream)
      oldStream.getTracks().forEach((track) => track.stop())
      await this.publishMyTracks()
    })
    this.syncTrackState()
  }

  setMicrophoneEnabled(enabled: boolean) {
    this.setTrackEnabled(Track.Source.Microphone, 'audio', enabled)
  }

  setCameraEnabled(enabled: boolean) {
    this.setTrackEnabled(Track.Source.Camera, 'video', enabled)
  }

  private setTrackEnabled(source: Track.Source, kind: 'audio' | 'video', enabled: boolean) {
    this.myStream?.getTracks().forEach((track) => {
      if (track.kind === kind) track.enabled = enabled
    })
    // let the others know, so they show a muted state instead of a frozen picture
    const publication = this.room?.localParticipant.getTrackPublication(source)
    if (enabled) publication?.unmute()
    else publication?.mute()
    this.syncTrackState()
  }

  private syncTrackState() {
    const audioTrack = this.myStream?.getAudioTracks()[0]
    const videoTrack = this.myStream?.getVideoTracks()[0]
    this.options.onTrackStateChange?.(
      audioTrack ? audioTrack.enabled : null,
      videoTrack ? videoTrack.enabled : null
    )
    this.emit()
  }

  // --- location in the office ---

  /**
   * Called regularly by the game with the media location of my player and the
   * distances to the other players.
   */
  updateLocation(location: MediaLocation | null, distances: Map<string, number>) {
    const key = location ? `${location.room}:${location.canPublish}` : 'none'
    if (key !== this.locationKey) {
      this.locationKey = key
      this.enqueue(() => this.moveTo(location))
    }

    // hysteresis for the open office
    let changed = false
    for (const [id, distance] of distances) {
      if (distance <= NEAR_DISTANCE && !this.nearby.has(id)) {
        this.nearby.add(id)
        changed = true
      } else if (distance > FAR_DISTANCE && this.nearby.has(id)) {
        this.nearby.delete(id)
        changed = true
      }
    }
    for (const id of this.nearby) {
      if (!distances.has(id)) {
        this.nearby.delete(id)
        changed = true
      }
    }
    if (changed) this.applySubscriptions()
  }

  private async moveTo(location: MediaLocation | null) {
    await this.disconnect()
    this.location = location
    if (!location) return

    this.setStatus('connecting')
    let grant: MediaGrant | null
    try {
      grant = await this.network.requestMediaGrant({ kind: 'location' })
    } catch (error) {
      console.warn('Video chat unavailable', error)
      this.setStatus('unavailable')
      return this.retryLater()
    }
    // the server has the final say about the room, e.g. if my position just changed
    if (!grant) return this.setStatus('off')

    const room = new Room({ dynacast: true })
    this.registerRoomEvents(room)
    try {
      await room.connect(grant.url, grant.token, {
        ...this.options.connectOptions,
        autoSubscribe: false,
      })
    } catch (error) {
      console.warn('Could not connect to the video chat', error)
      this.setStatus('unavailable')
      return this.retryLater()
    }
    this.room = room
    this.location = grant
    this.snapshot = { ...this.snapshot, canPublish: grant.canPublish }
    this.setStatus('connected')
    await this.publishMyTracks()
    this.applySubscriptions()
  }

  // forget the current location, so the next location update connects again
  private retryLater() {
    const key = this.locationKey
    window.setTimeout(() => {
      if (this.locationKey === key) this.locationKey = undefined
    }, RETRY_DELAY)
  }

  private async disconnect() {
    const room = this.room
    if (!room) return
    this.room = undefined
    this.speaking.clear()
    this.streamCache.clear()
    // keep my camera running, it's published again in the next room
    await room.disconnect(false)
    this.setStatus('off')
  }

  // --- LiveKit room ---

  private registerRoomEvents(room: Room) {
    const update = () => {
      if (room === this.room) this.emit()
    }
    room
      .on(RoomEvent.TrackPublished, (publication, participant) =>
        this.applySubscription(publication, participant)
      )
      .on(RoomEvent.TrackSubscribed, update)
      .on(RoomEvent.TrackUnsubscribed, update)
      .on(RoomEvent.TrackMuted, update)
      .on(RoomEvent.TrackUnmuted, update)
      .on(RoomEvent.ParticipantDisconnected, update)
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        this.speaking = new Set(speakers.map((speaker) => speaker.identity))
        update()
      })
      .on(RoomEvent.Disconnected, () => {
        // lost connection or kicked, try again on the next location update
        if (room === this.room) {
          this.room = undefined
          this.locationKey = undefined
          this.setStatus('off')
        }
      })
  }

  private async publishMyTracks() {
    const room = this.room
    if (!room || !this.myStream || !this.location?.canPublish) return
    for (const track of this.myStream.getTracks()) {
      const source = track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone
      if (room.localParticipant.getTrackPublication(source)) continue
      const publication: LocalTrackPublication = await room.localParticipant.publishTrack(track, {
        source,
      })
      if (!track.enabled) await publication.mute()
    }
  }

  private async unpublishTracks(stream: MediaStream) {
    const room = this.room
    if (!room) return
    for (const track of stream.getTracks()) await room.localParticipant.unpublishTrack(track, false)
  }

  private shouldListenTo(identity: string) {
    return this.location?.mode === 'everyone' || this.nearby.has(identity)
  }

  private applySubscription(publication: RemoteTrackPublication, participant: RemoteParticipant) {
    publication.setSubscribed(this.shouldListenTo(participant.identity))
  }

  private applySubscriptions() {
    for (const participant of this.room?.remoteParticipants.values() ?? []) {
      for (const publication of participant.trackPublications.values()) {
        this.applySubscription(publication, participant)
      }
    }
    this.emit()
  }

  private enqueue(task: () => Promise<void>) {
    this.queue = this.queue.then(task).catch((error) => console.error('Video chat error', error))
  }

  // --- snapshot for React (useSyncExternalStore) ---

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.snapshot

  private setStatus(status: MediaStatus) {
    this.snapshot = { ...this.snapshot, status }
    this.emit()
  }

  private streamFor(track: MediaStreamTrack) {
    let stream = this.streamCache.get(track.id)
    if (!stream) {
      stream = new MediaStream([track])
      this.streamCache.set(track.id, stream)
    }
    return stream
  }

  private emit() {
    const tiles: MediaTile[] = []

    if (this.myStream) {
      const video = this.myStream.getVideoTracks()[0]
      const audio = this.myStream.getAudioTracks()[0]
      tiles.push({
        id: this.mySessionId,
        name: 'You',
        isLocal: true,
        videoStream: video ? this.streamFor(video) : undefined,
        videoMuted: !video?.enabled,
        audioMuted: !audio?.enabled,
        speaking: this.speaking.has(this.mySessionId),
      })
    }

    for (const participant of this.room?.remoteParticipants.values() ?? []) {
      const video = participant.getTrackPublication(Track.Source.Camera)
      const audio = participant.getTrackPublication(Track.Source.Microphone)
      const videoTrack = video?.isSubscribed ? video.track?.mediaStreamTrack : undefined
      const audioTrack = audio?.isSubscribed ? audio.track?.mediaStreamTrack : undefined
      if (!videoTrack && !audioTrack) continue
      tiles.push({
        id: participant.identity,
        name: participant.name || participant.identity,
        isLocal: false,
        videoStream: videoTrack ? this.streamFor(videoTrack) : undefined,
        audioStream: audioTrack ? this.streamFor(audioTrack) : undefined,
        videoMuted: !videoTrack || !!video?.isMuted,
        audioMuted: !audioTrack || !!audio?.isMuted,
        speaking: this.speaking.has(participant.identity),
      })
    }

    this.snapshot = { ...this.snapshot, tiles }
    this.listeners.forEach((listener) => listener())
  }
}
