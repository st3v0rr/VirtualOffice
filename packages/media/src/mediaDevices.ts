export type MediaSettings = {
  videoInputId: string
  audioInputId: string
  audioOutputId: string
  videoEnabled: boolean
  audioEnabled: boolean
}

export type MediaDeviceLists = {
  videoInputs: MediaDeviceInfo[]
  audioInputs: MediaDeviceInfo[]
  audioOutputs: MediaDeviceInfo[]
}

const STORAGE_KEY = 'skyoffice:media-settings'

const defaultSettings: MediaSettings = {
  videoInputId: '',
  audioInputId: '',
  audioOutputId: '',
  videoEnabled: true,
  audioEnabled: true,
}

// speaker selection is not supported by every browser (e.g. Firefox without flag, Safari on iOS)
export const supportsAudioOutputSelection =
  typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype

export function loadMediaSettings(): MediaSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) }
  } catch {
    // storage may be unavailable (private mode, blocked site data)
  }
  return { ...defaultSettings }
}

export function saveMediaSettings(settings: MediaSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore, settings are a convenience only
  }
}

export async function listMediaDevices(): Promise<MediaDeviceLists> {
  const devices = (await navigator.mediaDevices?.enumerateDevices()) ?? []
  // before permission is granted, browsers return devices without id/label
  const usable = devices.filter((device) => device.deviceId !== '')
  return {
    videoInputs: usable.filter((device) => device.kind === 'videoinput'),
    audioInputs: usable.filter((device) => device.kind === 'audioinput'),
    audioOutputs: usable.filter((device) => device.kind === 'audiooutput'),
  }
}

// whether the user already granted camera or microphone access on an earlier visit
export async function hasMediaPermission() {
  try {
    const results = await Promise.all(
      (['camera', 'microphone'] as PermissionName[]).map((name) =>
        navigator.permissions.query({ name })
      )
    )
    return results.some((result) => result.state === 'granted')
  } catch {
    return false
  }
}

function deviceConstraint(deviceId: string): MediaTrackConstraints | boolean {
  return deviceId ? { deviceId: { exact: deviceId } } : true
}

/**
 * Request a camera + microphone stream for the given devices. Falls back to the default
 * devices if a stored device is gone, and to audio or video only if one of them is missing.
 */
export async function getMediaStream(settings: MediaSettings): Promise<MediaStream> {
  const mediaDevices = navigator.mediaDevices
  if (!mediaDevices) throw new Error('Media devices are not available (insecure context?)')

  const attempts: MediaStreamConstraints[] = [
    {
      video: deviceConstraint(settings.videoInputId),
      audio: deviceConstraint(settings.audioInputId),
    },
    { video: true, audio: true },
    { video: false, audio: true },
    { video: true, audio: false },
  ]

  let lastError: unknown
  for (const constraints of attempts) {
    try {
      return await mediaDevices.getUserMedia(constraints)
    } catch (error) {
      lastError = error
      // the user denied access, trying other constraints won't help
      if (error instanceof DOMException && error.name === 'NotAllowedError') break
    }
  }
  throw lastError
}

export function applyTrackSettings(stream: MediaStream, settings: MediaSettings) {
  stream.getVideoTracks().forEach((track) => (track.enabled = settings.videoEnabled))
  stream.getAudioTracks().forEach((track) => (track.enabled = settings.audioEnabled))
}

export async function setAudioOutput(element: HTMLMediaElement, deviceId: string) {
  if (!supportsAudioOutputSelection) return
  try {
    await element.setSinkId(deviceId)
  } catch (error) {
    console.warn('Could not switch audio output device', error)
  }
}

// play a short test tone on the given speaker
export async function playTestSound(deviceId: string) {
  const context = new AudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const destination = context.createMediaStreamDestination()

  oscillator.frequency.value = 440
  gain.gain.setValueAtTime(0.2, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.8)
  oscillator.connect(gain).connect(destination)

  const audio = new Audio()
  audio.srcObject = destination.stream
  await setAudioOutput(audio, deviceId)
  await audio.play()

  oscillator.start()
  oscillator.stop(context.currentTime + 0.8)
  oscillator.onended = () => {
    audio.pause()
    audio.srcObject = null
    context.close()
  }
}
