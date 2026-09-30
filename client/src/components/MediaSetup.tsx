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
import { playTestSound, supportsAudioOutputSelection } from '@skyoffice/media'
import { type MediaSetupState, useMediaSetup, useMicLevel } from '@skyoffice/media/react'

export { useMediaSetup, type MediaSetupState }

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
  const level = useMicLevel(stream, enabled)

  return (
    <LinearProgress
      variant="determinate"
      color="secondary"
      value={level}
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
