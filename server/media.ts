import { AccessToken } from 'livekit-server-sdk'
import type { MediaGrant, MediaLocation } from '../types/Media.ts'

const isProduction = process.env.NODE_ENV === 'production'

// defaults match `livekit-server --dev`; empty variables (e.g. from docker compose) count
// as not set
const config = {
  url: process.env.LIVEKIT_URL || (isProduction ? undefined : 'ws://localhost:7880'),
  apiKey: process.env.LIVEKIT_API_KEY || (isProduction ? undefined : 'devkey'),
  apiSecret: process.env.LIVEKIT_API_SECRET || (isProduction ? undefined : 'secret'),
}

export const mediaEnabled = !!(config.url && config.apiKey && config.apiSecret)
if (!mediaEnabled) {
  console.warn('LIVEKIT_URL, LIVEKIT_API_KEY or LIVEKIT_API_SECRET missing: video chat is disabled')
}

type Participant = { identity: string; name: string }

// a token that lets the participant join exactly this LiveKit room
export async function createMediaGrant(
  officeRoomId: string,
  location: MediaLocation,
  participant: Participant
): Promise<MediaGrant> {
  if (!mediaEnabled) throw new Error('Video chat is not configured on this server')

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: participant.identity,
    name: participant.name,
    ttl: '6h',
  })
  token.addGrant({
    room: `${officeRoomId}/${location.room}`,
    roomJoin: true,
    canSubscribe: true,
    canPublish: location.canPublish,
    canPublishData: false,
  })

  return { ...location, url: config.url!, token: await token.toJwt() }
}
