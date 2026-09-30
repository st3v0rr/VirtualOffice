import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTrackSettings,
  getMediaStream,
  listMediaDevices,
  loadMediaSettings,
  saveMediaSettings,
  type MediaSettings,
} from '../src/mediaDevices'
import { memoryStorage } from './storage'

const KEY = 'skyoffice:media-settings'
const settings: MediaSettings = {
  videoInputId: 'cam-2',
  audioInputId: 'mic-1',
  audioOutputId: 'speaker-3',
  videoEnabled: false,
  audioEnabled: true,
}

describe('media settings persistence', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('defaults to the system devices with camera and microphone on', () => {
    expect(loadMediaSettings()).toEqual({
      videoInputId: '',
      audioInputId: '',
      audioOutputId: '',
      videoEnabled: true,
      audioEnabled: true,
    })
  })

  it('stores and loads the settings', () => {
    saveMediaSettings(settings)
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(settings)
    expect(loadMediaSettings()).toEqual(settings)
  })

  it('fills in settings missing in older stored data', () => {
    localStorage.setItem(KEY, JSON.stringify({ videoEnabled: false }))
    expect(loadMediaSettings()).toMatchObject({
      videoEnabled: false,
      audioEnabled: true,
      audioOutputId: '',
    })
  })

  it('falls back to the defaults on broken data', () => {
    localStorage.setItem(KEY, '{not json')
    expect(loadMediaSettings().videoEnabled).toBe(true)
  })

  it('works without usable storage (private mode)', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    vi.stubGlobal('localStorage', broken)
    expect(() => saveMediaSettings(settings)).not.toThrow()
    expect(loadMediaSettings().audioEnabled).toBe(true)
  })

  it('returns a fresh object each time, so callers can change it', () => {
    const a = loadMediaSettings()
    a.videoEnabled = false
    expect(loadMediaSettings().videoEnabled).toBe(true)
  })
})

// a MediaStream stand-in with just what the helpers use
const track = (kind: 'audio' | 'video') => ({ kind, enabled: true })
const stream = (...tracks: ReturnType<typeof track>[]) =>
  ({
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
  }) as unknown as MediaStream

describe('applyTrackSettings', () => {
  it('switches the camera and microphone tracks on or off', () => {
    const video = track('video')
    const audio = track('audio')
    applyTrackSettings(stream(video, audio), {
      ...settings,
      videoEnabled: false,
      audioEnabled: true,
    })
    expect(video.enabled).toBe(false)
    expect(audio.enabled).toBe(true)
    applyTrackSettings(stream(video, audio), {
      ...settings,
      videoEnabled: true,
      audioEnabled: false,
    })
    expect(video.enabled).toBe(true)
    expect(audio.enabled).toBe(false)
  })
})

describe('getMediaStream', () => {
  afterEach(() => vi.unstubAllGlobals())

  const withDevices = (getUserMedia: (c: MediaStreamConstraints) => Promise<unknown>) =>
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(getUserMedia) } })

  it('asks for the chosen devices first', async () => {
    const result = stream(track('video'))
    withDevices(async () => result)
    await expect(getMediaStream(settings)).resolves.toBe(result)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { deviceId: { exact: 'cam-2' } },
      audio: { deviceId: { exact: 'mic-1' } },
    })
  })

  it('falls back to the default devices, then to audio or video only', async () => {
    const result = stream(track('audio'))
    withDevices(async (c) => {
      if (c.video === false && c.audio === true) return result
      throw new DOMException('gone', 'NotFoundError')
    })
    await expect(getMediaStream(settings)).resolves.toBe(result)
    expect(vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls.map(([c]) => c)).toEqual([
      { video: { deviceId: { exact: 'cam-2' } }, audio: { deviceId: { exact: 'mic-1' } } },
      { video: true, audio: true },
      { video: false, audio: true },
    ])
  })

  it('stops trying when the user denied access', async () => {
    withDevices(async () => {
      throw new DOMException('denied', 'NotAllowedError')
    })
    await expect(getMediaStream(settings)).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('fails clearly without media devices (insecure context)', async () => {
    vi.stubGlobal('navigator', {})
    await expect(getMediaStream(settings)).rejects.toThrow(/insecure context/)
  })
})

describe('listMediaDevices', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sorts devices by kind and skips the ones without permission yet', async () => {
    const device = (kind: string, deviceId: string) => ({ kind, deviceId, label: deviceId })
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: async () => [
          device('videoinput', 'cam'),
          device('audioinput', ''),
          device('audioinput', 'mic'),
          device('audiooutput', 'speaker'),
        ],
      },
    })
    const lists = await listMediaDevices()
    expect(lists.videoInputs.map((d) => d.deviceId)).toEqual(['cam'])
    expect(lists.audioInputs.map((d) => d.deviceId)).toEqual(['mic'])
    expect(lists.audioOutputs.map((d) => d.deviceId)).toEqual(['speaker'])
  })
})
