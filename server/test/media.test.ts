import { afterEach, describe, expect, it, vi } from 'vitest'

// server/media.ts reads its configuration when it is loaded, so every test loads it anew
async function loadMedia(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  return import('../media.ts')
}

const payload = (jwt: string) =>
  JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const participant = { identity: 'session-1', name: 'Alice' }

describe('createMediaGrant', () => {
  it('hands out a token for exactly the LiveKit room of the location', async () => {
    const media = await loadMedia({
      NODE_ENV: 'production',
      LIVEKIT_URL: 'wss://lk.example.test',
      LIVEKIT_API_KEY: 'key',
      LIVEKIT_API_SECRET: 'a-test-secret-that-is-long-enough-for-hs256',
    })
    expect(media.mediaEnabled).toBe(true)
    const grant = await media.createMediaGrant(
      'office1',
      { room: 'zone-1329', mode: 'everyone', canPublish: false },
      participant
    )
    expect(grant).toMatchObject({
      url: 'wss://lk.example.test',
      room: 'zone-1329',
      canPublish: false,
    })
    const claims = payload(grant.token)
    expect(claims.sub).toBe('session-1')
    expect(claims.name).toBe('Alice')
    expect(claims.video).toMatchObject({
      room: 'office1/zone-1329',
      roomJoin: true,
      canSubscribe: true,
      canPublish: false,
      canPublishData: false,
    })
  })

  it('is off in production without configuration', async () => {
    const media = await loadMedia({
      NODE_ENV: 'production',
      LIVEKIT_URL: undefined,
      LIVEKIT_API_KEY: undefined,
      LIVEKIT_API_SECRET: undefined,
    })
    expect(media.mediaEnabled).toBe(false)
    await expect(
      media.createMediaGrant(
        'o',
        { room: 'open', mode: 'proximity', canPublish: true },
        participant
      )
    ).rejects.toThrow(/not configured/)
  })

  it('uses the livekit-server --dev defaults in development', async () => {
    const media = await loadMedia({
      NODE_ENV: 'development',
      LIVEKIT_URL: undefined,
      LIVEKIT_API_KEY: undefined,
      LIVEKIT_API_SECRET: undefined,
    })
    const grant = await media.createMediaGrant(
      'o',
      { room: 'open', mode: 'proximity', canPublish: true },
      participant
    )
    expect(grant.url).toBe('ws://localhost:7880')
  })
})
