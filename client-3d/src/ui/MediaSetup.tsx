import { useEffect, useState } from 'react'
import {
  playTestSound,
  saveMediaSettings,
  supportsAudioOutputSelection,
  type MediaSettings,
} from '@skyoffice/media'
import { useMediaSetup } from '@skyoffice/media/react'
import { useGame } from '../state/game'
import { setMyMedia } from '../media/media'
import { DeviceSelect, MicLevel, Preview, activeDeviceIds, describeMediaError } from './mediaParts'

// Camera, microphone and speaker, like the media setup of the 2D client's join and
// settings dialogs (same hook, same stored settings), in the look of the 3D HUD.

const close = () => useGame.getState().set({ mediaSetupOpen: false })

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
  const media = useMediaSetup(live, describeMediaError)
  const { settings, devices, stream, error, requested, requestAccess, updateSettings } = media

  // camera and microphone are off on a first visit; granting access here means using them
  const allow = () => {
    if (!settings.audioEnabled && !settings.videoEnabled)
      updateSettings({ audioEnabled: true, videoEnabled: true })
    requestAccess()
  }

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
  const active = activeDeviceIds(stream, settings.videoInputId, settings.audioInputId)
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
            <button className="primary" onClick={allow}>
              Kamera &amp; Mikrofon freigeben
            </button>
            <p className="muted">Du kannst auch ohne beitreten und später verbinden.</p>
          </>
        ) : (
          <>
            {error && (
              <p className="error" role="alert">
                {error}{' '}
                <button className="link" onClick={requestAccess}>
                  Erneut versuchen
                </button>
              </p>
            )}
            <DeviceSelect
              label="Kamera"
              devices={devices.videoInputs}
              value={active.video}
              onChange={(videoInputId) => updateSettings({ videoInputId })}
            />
            <DeviceSelect
              label="Mikrofon"
              devices={devices.audioInputs}
              value={active.audio}
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
