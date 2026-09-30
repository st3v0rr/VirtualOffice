import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type MediaDeviceLists,
  type MediaSettings,
  applyTrackSettings,
  getMediaStream,
  hasMediaPermission,
  listMediaDevices,
  loadMediaSettings,
} from './mediaDevices'

// React hooks for the camera/microphone setup, shared by the 2D and the 3D client
// (import from '@skyoffice/media/react', the rest of the package works without React).

const emptyDeviceLists: MediaDeviceLists = { videoInputs: [], audioInputs: [], audioOutputs: [] }

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

export function describeMediaError(error: unknown) {
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
export function useMediaSetup(
  initialSettings?: Partial<MediaSettings>,
  // turns an error of getUserMedia into a message for the user
  describeError: (error: unknown) => string = describeMediaError
) {
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

// the loudness of the microphone in the stream, 0..100, for a level meter
export function useMicLevel(stream: MediaStream, enabled: boolean) {
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

  return enabled ? level : 0
}
