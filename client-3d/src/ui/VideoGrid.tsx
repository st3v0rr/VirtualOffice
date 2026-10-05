import { useEffect, useRef } from 'react'
import { setAudioOutput } from '@skyoffice/media'
import { useGame } from '../state/game'
import { startMedia, stopMedia, useMedia, type MediaTile } from '../media/media'

// The faces and voices of the people I hear, like the VideoGrid of the 2D client.

const TILE_COLORS = ['#ffc8d0', '#c9e9ff', '#d7f2c8', '#e6d7ff', '#ffe6b8', '#c8f0ea']

function colorFor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) | 0
  return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length]
}

function Video({ stream, mirrored }: { stream: MediaStream; mirrored: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted className={mirrored ? 'mirrored' : ''} />
}

// plays the voice of someone on the speaker chosen in the setup
function AudioPlayer({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null)
  const audioOutputId = useGame((s) => s.audioOutputId)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  useEffect(() => {
    if (ref.current) setAudioOutput(ref.current, audioOutputId)
  }, [audioOutputId])
  return <audio ref={ref} autoPlay />
}

function VideoTile({ tile }: { tile: MediaTile }) {
  // names can change, the one in the LiveKit token may be outdated
  const name = useGame((s) => (tile.isLocal ? 'Du' : (s.players[tile.id]?.name ?? tile.name)))
  return (
    <div className={`video-tile ${tile.speaking ? 'speaking' : ''}`}>
      {tile.videoStream && !tile.videoMuted ? (
        <Video stream={tile.videoStream} mirrored={tile.isLocal} />
      ) : (
        <div className="placeholder">
          <div className="avatar" style={{ background: colorFor(name) }}>
            {name.slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}
      {tile.audioStream && <AudioPlayer stream={tile.audioStream} />}
      <div className="label">
        {tile.audioMuted && <span title="stumm">🔇</span>}
        <span>{name}</span>
      </div>
    </div>
  )
}

// the local self-preview, mirrored, for the bottom-right stack
export function SelfPreview() {
  const { tiles } = useMedia()
  const camera = useGame((s) => s.camera)
  const local = tiles.find((t) => t.isLocal)
  return (
    <div className="self-preview">
      {local?.videoStream && !local.videoMuted ? (
        <Video stream={local.videoStream} mirrored />
      ) : (
        <div className="placeholder">
          <div className="avatar" style={{ background: '#d7f2c8' }}>
            🙂
          </div>
          {camera === false && <span className="camera-off">Kamera aus</span>}
        </div>
      )}
      <span className="label self-label">Du</span>
    </div>
  )
}

export default function VideoGrid() {
  const sessionId = useGame((s) => s.sessionId)
  const { tiles, status, canPublish } = useMedia()
  const remoteTiles = tiles.filter((t) => !t.isLocal)

  useEffect(() => {
    if (!sessionId) return
    // uses the camera/microphone chosen on the join screen, if any (see setMyMedia);
    // without, the HUD offers to set them up later
    startMedia(sessionId)
    return () => stopMedia()
  }, [sessionId])

  return (
    <div className="video-grid">
      {status === 'connected' && !canPublish && (
        <div className="notice">Du bist im Publikum. Geh auf die Bühne, um zu sprechen.</div>
      )}
      {remoteTiles.map((tile) => (
        <VideoTile key={tile.id} tile={tile} />
      ))}
    </div>
  )
}
