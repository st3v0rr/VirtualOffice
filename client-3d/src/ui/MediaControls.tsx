import { useGame } from '../state/game'
import { setCameraEnabled, setMicrophoneEnabled, useMedia } from '../media/media'

// Video chat in the HUD: where I am (connected, audience, quiet zone, unavailable) and
// the microphone/camera toggles, like MediaControls of the 2D client.

export function Status() {
  const { status, canPublish } = useMedia()
  const quietZone = useGame((s) => s.quietZone)

  if (quietZone)
    return (
      <span className="pill media-quiet" title="In der Bibliothek gibt es kein Audio und Video">
        🤫 Ruhezone
      </span>
    )
  switch (status) {
    case 'connecting':
      return <span className="pill">🎥 verbinde …</span>
    case 'connected':
      return canPublish ? (
        <span className="pill media-connected" title="Du hörst die Leute in deiner Nähe">
          🎥 Video-Chat
        </span>
      ) : (
        <span className="pill media-connected" title="Auf der Bühne kannst du sprechen">
          🎧 Publikum
        </span>
      )
    case 'unavailable':
      return (
        <span
          className="pill media-unavailable"
          title="Kein LiveKit-Server erreichbar. Neuer Versuch alle 10 Sekunden, das Büro läuft normal weiter."
        >
          🎥 Video-Chat nicht verfügbar
        </span>
      )
    default:
      return null
  }
}

export default function MediaControls() {
  const videoConnected = useGame((s) => s.videoConnected)
  const microphone = useGame((s) => s.microphone)
  const camera = useGame((s) => s.camera)
  const openSetup = () => useGame.getState().set({ mediaSetupOpen: true })

  return (
    <>
      {videoConnected ? (
        <>
          <button
            className={`pill button toggle ${microphone === false ? 'off' : ''}`}
            disabled={microphone === null}
            title={microphone ? 'Mikrofon stummschalten' : 'Mikrofon an'}
            onClick={() => setMicrophoneEnabled(!microphone)}
          >
            {microphone === false || microphone === null ? '🔇' : '🎙️'}
          </button>
          <button
            className={`pill button toggle ${camera === false ? 'off' : ''}`}
            disabled={camera === null}
            title={camera ? 'Kamera aus' : 'Kamera an'}
            onClick={() => setCameraEnabled(!camera)}
          >
            {camera === false || camera === null ? '🚫' : '📷'}
          </button>
          <button
            className="pill button"
            title="Kamera, Mikrofon, Lautsprecher"
            onClick={openSetup}
          >
            🎛️
          </button>
        </>
      ) : (
        <button className="pill button media-setup" onClick={openSetup}>
          🎙️ Mikro &amp; Kamera
        </button>
      )}
    </>
  )
}
