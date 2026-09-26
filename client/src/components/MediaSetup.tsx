import { useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Tooltip from '@mui/material/Tooltip'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'

import Video from './Video'
import {
  type MediaDeviceLists,
  type MediaSettings,
  applyTrackSettings,
  getMediaStream,
  hasMediaPermission,
  listMediaDevices,
  loadMediaSettings,
  playTestSound,
  supportsAudioOutputSelection,
} from '../web/mediaDevices'

const emptyDeviceLists: MediaDeviceLists = { videoInputs: [], audioInputs: [], audioOutputs: [] }

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

function describeError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError')
      return 'Access was denied. Allow camera and microphone in your browser settings.'
    if (error.name === 'NotFoundError') return 'No camera or microphone found.'
    if (error.name === 'NotReadableError')
      return 'Camera or microphone is already in use by another application.'
  }
  return error instanceof Error ? error.message : 'Could not access camera or microphone.'
}

/**
 * Manages the camera/microphone preview stream and the device settings of the join screen.
 * Call `release()` to take over the stream, otherwise it is stopped on unmount.
 * The settings are not persisted here, save them once the user confirms.
 */
export function useMediaSetup(initialSettings?: Partial<MediaSettings>) {
  const [settings, setSettings] = useState<MediaSettings>(() => ({
    ...loadMediaSettings(),
    ...initialSettings,
  }))
  const [devices, setDevices] = useState<MediaDeviceLists>(emptyDeviceLists)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requested, setRequested] = useState(false)
  const releasedRef = useRef(false)

  // skip the extra click if the user already granted access on an earlier visit
  useEffect(() => {
    hasMediaPermission().then((granted) => {
      if (granted) setRequested(true)
    })
  }, [])

  const { videoInputId, audioInputId } = settings
  useEffect(() => {
    if (!requested) return
    let cancelled = false
    let acquired: MediaStream | null = null

    getMediaStream({ ...settings, videoInputId, audioInputId })
      .then(async (newStream) => {
        if (cancelled) return stopStream(newStream)
        acquired = newStream
        setStream(newStream)
        setError(null)
        const lists = await listMediaDevices()
        if (!cancelled) setDevices(lists)
      })
      .catch((e) => {
        if (!cancelled) setError(describeError(e))
      })

    return () => {
      cancelled = true
      if (acquired && !releasedRef.current) stopStream(acquired)
    }
    // settings other than the device ids are applied without requesting a new stream
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, videoInputId, audioInputId])

  // refresh the device lists when a device gets plugged in or removed
  useEffect(() => {
    if (!requested) return
    const handleDeviceChange = () => listMediaDevices().then(setDevices)
    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange)
  }, [requested])

  useEffect(() => {
    if (stream) applyTrackSettings(stream, settings)
  }, [stream, settings])

  const updateSettings = useCallback((changes: Partial<MediaSettings>) => {
    setSettings((current) => ({ ...current, ...changes }))
  }, [])

  const release = useCallback(() => {
    releasedRef.current = true
    return stream
  }, [stream])

  return {
    settings,
    devices,
    stream,
    error,
    requested,
    requestAccess: () => setRequested(true),
    updateSettings,
    release,
  }
}

export type MediaSetupState = ReturnType<typeof useMediaSetup>

const Wrapper = styled.div`
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  color: #eee;
`

const Preview = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #15172a;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 14px;

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
  }

  .toggles {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
  }

  .toggles button {
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
  }

  .toggles button.off {
    background: #d32f2f;
  }
`

const DeviceRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const Hint = styled.p`
  margin: 0;
  font-size: 12px;
  color: #999;
`

function MicLevel({ stream, enabled }: { stream: MediaStream; enabled: boolean }) {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!enabled || stream.getAudioTracks().length === 0) return

    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    context.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)

    let frame = 0
    const update = () => {
      analyser.getFloatTimeDomainData(samples)
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
      setLevel(Math.min(100, rms * 400))
      frame = requestAnimationFrame(update)
    }
    update()

    return () => {
      cancelAnimationFrame(frame)
      context.close()
    }
  }, [stream, enabled])

  return (
    <LinearProgress
      variant="determinate"
      color="secondary"
      value={enabled ? level : 0}
      aria-label="microphone level"
    />
  )
}

type DeviceSelectProps = {
  label: string
  devices: MediaDeviceInfo[]
  value: string
  onChange: (deviceId: string) => void
}

function DeviceSelect({ label, devices, value, onChange }: DeviceSelectProps) {
  const id = `device-select-${label.toLowerCase()}`
  // fall back to the first entry if the stored device is no longer available
  const selected = devices.some((device) => device.deviceId === value)
    ? value
    : (devices[0]?.deviceId ?? '')

  return (
    <FormControl fullWidth size="small" color="secondary" disabled={devices.length === 0}>
      <InputLabel id={id}>{label}</InputLabel>
      <Select
        labelId={id}
        label={label}
        value={selected}
        onChange={(event) => onChange(event.target.value)}
      >
        {devices.length === 0 && <MenuItem value="">No device found</MenuItem>}
        {devices.map((device, index) => (
          <MenuItem key={device.deviceId} value={device.deviceId}>
            {device.label || `${label} ${index + 1}`}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

export default function MediaSetup({ media }: { media: MediaSetupState }) {
  const { settings, devices, stream, error, requested, requestAccess, updateSettings } = media

  // show the device that is actually in use, which may differ after a fallback
  const activeVideoId = stream?.getVideoTracks()[0]?.getSettings().deviceId ?? settings.videoInputId
  const activeAudioId = stream?.getAudioTracks()[0]?.getSettings().deviceId ?? settings.audioInputId
  const hasVideo = !!stream && stream.getVideoTracks().length > 0

  return (
    <Wrapper>
      <SectionTitle>Audio &amp; Video</SectionTitle>

      {!requested ? (
        <>
          <Preview>Camera and microphone are off</Preview>
          <Button variant="outlined" color="secondary" onClick={requestAccess}>
            Set up camera &amp; microphone
          </Button>
          <Hint>You can also join without them and connect later.</Hint>
        </>
      ) : (
        <>
          <Preview>
            {hasVideo && settings.videoEnabled ? (
              <Video srcObject={stream} autoPlay playsInline muted />
            ) : (
              <span>{stream ? 'Camera is off' : error ? '' : 'Waiting for access…'}</span>
            )}
            {stream && (
              <div className="toggles">
                <Tooltip title={settings.audioEnabled ? 'Mute microphone' : 'Unmute microphone'}>
                  <IconButton
                    size="small"
                    className={settings.audioEnabled ? '' : 'off'}
                    onClick={() => updateSettings({ audioEnabled: !settings.audioEnabled })}
                  >
                    {settings.audioEnabled ? <MicIcon /> : <MicOffIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={settings.videoEnabled ? 'Turn camera off' : 'Turn camera on'}>
                  <IconButton
                    size="small"
                    className={settings.videoEnabled ? '' : 'off'}
                    onClick={() => updateSettings({ videoEnabled: !settings.videoEnabled })}
                  >
                    {settings.videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                  </IconButton>
                </Tooltip>
              </div>
            )}
          </Preview>

          {error && (
            <Alert variant="outlined" severity="warning">
              {error}
            </Alert>
          )}

          <DeviceSelect
            label="Camera"
            devices={devices.videoInputs}
            value={activeVideoId}
            onChange={(videoInputId) => updateSettings({ videoInputId })}
          />
          <DeviceSelect
            label="Microphone"
            devices={devices.audioInputs}
            value={activeAudioId}
            onChange={(audioInputId) => updateSettings({ audioInputId })}
          />
          {stream && <MicLevel stream={stream} enabled={settings.audioEnabled} />}

          <DeviceRow>
            {supportsAudioOutputSelection ? (
              <DeviceSelect
                label="Speaker"
                devices={devices.audioOutputs}
                value={settings.audioOutputId}
                onChange={(audioOutputId) => updateSettings({ audioOutputId })}
              />
            ) : (
              <Hint style={{ flex: 1 }}>
                This browser always uses the system speaker, it can&apos;t be changed here.
              </Hint>
            )}
            <Tooltip title="Play test sound">
              <IconButton
                color="secondary"
                aria-label="play test sound"
                onClick={() => playTestSound(settings.audioOutputId)}
              >
                <VolumeUpIcon />
              </IconButton>
            </Tooltip>
          </DeviceRow>
        </>
      )}
    </Wrapper>
  )
}
