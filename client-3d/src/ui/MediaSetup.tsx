import { useEffect, useRef, useState } from 'react'
import {
  playTestSound,
  saveMediaSettings,
  supportsAudioOutputSelection,
  type MediaSettings,
} from '@skyoffice/media'
import { useMediaSetup, useMicLevel } from '@skyoffice/media/react'
import { useGame } from '../state/game'
import { setMyMedia } from '../media/media'

// Camera, microphone and speaker, like the media setup of the 2D client's join and
// settings dialogs (same hook, same stored settings), in the look of the 3D HUD.

function describeError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError')
      return 'Zugriff verweigert. Erlaube Kamera und Mikrofon in den Browser-Einstellungen.'
    if (error.name === 'NotFoundError') return 'Keine Kamera und kein Mikrofon gefunden.'
    if (error.name === 'NotReadableError')
      return 'Kamera oder Mikrofon wird gerade von einem anderen Programm benutzt.'
  }
  return error instanceof Error ? error.message : 'Kein Zugriff auf Kamera oder Mikrofon.'
}

const close = () => useGame.getState().set({ mediaSetupOpen: false })

function Preview({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted />
}

function MicLevel({ stream, enabled }: { stream: MediaStream; enabled: boolean }) {
  const level = useMicLevel(stream, enabled)
  return (
    <div className="mic-level" aria-label="Mikrofonpegel">
      <div style={{ width: `${level}%` }} />
    </div>
  )
}

type DeviceSelectProps = {
  label: string
  devices: MediaDeviceInfo[]
  value: string
  onChange: (deviceId: string) => void
}

function DeviceSelect({ label, devices, value, onChange }: DeviceSelectProps) {
  // fall back to the first entry if the stored device is no longer available
  const selected = devices.some((d) => d.deviceId === value) ? value : (devices[0]?.deviceId ?? '')
  return (
    <label className="device">
      <span>{label}</span>
      <select
        value={selected}
        disabled={devices.length === 0}
        onChange={(e) => onChange(e.target.value)}
      >
        {devices.length === 0 && <option value="">nicht gefunden</option>}
        {devices.map((device, i) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function MediaSetup() {
  const microphone = useGame((s) => s.microphone)
  const camera = useGame((s) => s.camera)
  // start from the live mute/camera state rather than the stored one
  const [live] = useState(() => {
    const settings: Partial<MediaSettings> = {}
    if (microphone !== null) settings.audioEnabled = microphone
    if (camera !== null) settings.videoEnabled = camera
    return settings
  })
  const media = useMediaSetup(live, describeError)
  const { settings, devices, stream, error, requested, requestAccess, updateSettings } = media

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const apply = () => {
    saveMediaSettings(settings)
    useGame.getState().set({ audioOutputId: settings.audioOutputId })
    // take over the preview stream, so it is used for the video chat right away
    const acquired = media.release()
    if (acquired) setMyMedia(acquired, settings)
    close()
  }

  // show the device that is actually in use, which may differ after a fallback
  const activeVideoId = stream?.getVideoTracks()[0]?.getSettings().deviceId ?? settings.videoInputId
  const activeAudioId = stream?.getAudioTracks()[0]?.getSettings().deviceId ?? settings.audioInputId
  const hasVideo = !!stream && stream.getVideoTracks().length > 0

  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div className="modal dialog media-dialog" onPointerDown={(e) => e.stopPropagation()}>
        <h2>🎙️ Mikro &amp; Kamera</h2>
        <div className="preview">
          {hasVideo && settings.videoEnabled ? (
            <Preview stream={stream} />
          ) : (
            <span>
              {!requested
                ? 'Kamera und Mikrofon sind aus'
                : stream
                  ? 'Kamera ist aus'
                  : error
                    ? '😿'
                    : 'Warte auf Freigabe …'}
            </span>
          )}
          {stream && (
            <div className="toggles">
              <button
                className={settings.audioEnabled ? '' : 'off'}
                title={settings.audioEnabled ? 'Mikrofon stummschalten' : 'Mikrofon an'}
                onClick={() => updateSettings({ audioEnabled: !settings.audioEnabled })}
              >
                {settings.audioEnabled ? '🎙️' : '🔇'}
              </button>
              <button
                className={settings.videoEnabled ? '' : 'off'}
                title={settings.videoEnabled ? 'Kamera aus' : 'Kamera an'}
                onClick={() => updateSettings({ videoEnabled: !settings.videoEnabled })}
              >
                {settings.videoEnabled ? '📷' : '🚫'}
              </button>
            </div>
          )}
        </div>

        {!requested ? (
          <>
            <button className="primary" onClick={requestAccess}>
              Kamera &amp; Mikrofon freigeben
            </button>
            <p className="muted">Du kannst auch ohne beitreten und später verbinden.</p>
          </>
        ) : (
          <>
            {error && <p className="error">{error}</p>}
            <DeviceSelect
              label="Kamera"
              devices={devices.videoInputs}
              value={activeVideoId}
              onChange={(videoInputId) => updateSettings({ videoInputId })}
            />
            <DeviceSelect
              label="Mikrofon"
              devices={devices.audioInputs}
              value={activeAudioId}
              onChange={(audioInputId) => updateSettings({ audioInputId })}
            />
            {stream && <MicLevel stream={stream} enabled={settings.audioEnabled} />}
            <div className="speaker">
              {supportsAudioOutputSelection ? (
                <DeviceSelect
                  label="Lautsprecher"
                  devices={devices.audioOutputs}
                  value={settings.audioOutputId}
                  onChange={(audioOutputId) => updateSettings({ audioOutputId })}
                />
              ) : (
                <p className="muted">Dieser Browser nutzt immer den System-Lautsprecher.</p>
              )}
              <button
                title="Testton abspielen"
                onClick={() => playTestSound(settings.audioOutputId)}
              >
                🔔
              </button>
            </div>
          </>
        )}

        <div className="toolbar end">
          <button className="secondary" onClick={close}>
            Abbrechen
          </button>
          <button className="primary" disabled={!stream} onClick={apply}>
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  )
}
