import { useEffect, useRef } from 'react'
import { useMicLevel } from '@skyoffice/media/react'

// Pieces of the camera/microphone setup shared by the join screen and the setup dialog.

export function describeMediaError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError')
      return 'Zugriff verweigert. Erlaube Kamera und Mikrofon in den Browser-Einstellungen.'
    if (error.name === 'NotFoundError') return 'Keine Kamera und kein Mikrofon gefunden.'
    if (error.name === 'NotReadableError')
      return 'Kamera oder Mikrofon wird gerade von einem anderen Programm benutzt.'
  }
  return error instanceof Error ? error.message : 'Kein Zugriff auf Kamera oder Mikrofon.'
}

export function Preview({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted aria-label="Kameravorschau" />
}

export function MicLevel({ stream, enabled }: { stream: MediaStream; enabled: boolean }) {
  const level = useMicLevel(stream, enabled)
  return (
    <div
      className="mic-level"
      role="meter"
      aria-label="Mikrofonpegel"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(level)}
    >
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

export function DeviceSelect({ label, devices, value, onChange }: DeviceSelectProps) {
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

// the device that is actually in use, which may differ from the stored one after a fallback
export function activeDeviceIds(
  stream: MediaStream | null,
  videoInputId: string,
  audioInputId: string
) {
  return {
    video: stream?.getVideoTracks()[0]?.getSettings().deviceId ?? videoInputId,
    audio: stream?.getAudioTracks()[0]?.getSettings().deviceId ?? audioInputId,
  }
}
