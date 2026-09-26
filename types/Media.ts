import { findZone, type Zone } from './OfficeMap.ts'

export type MediaTokenRequest = { kind: 'location' } | { kind: 'computer'; computerId: string }

// how the client picks whom to listen to in a media room
export type MediaMode =
  // only players close by (open office space)
  | 'proximity'
  // everyone in the room (meeting rooms, focus booths, auditorium, computers)
  | 'everyone'

export type MediaLocation = {
  room: string
  mode: MediaMode
  canPublish: boolean
}

export type MediaGrant = MediaLocation & { url: string; token: string }

/**
 * The media room for a position in the office, or null where there is no audio/video
 * (quiet zones). Server and client share this, so both agree on when to switch rooms.
 */
export function getMediaLocation(zones: Zone[], x: number, y: number): MediaLocation | null {
  const zone = findZone(zones, x, y)
  switch (zone?.type) {
    case 'quiet':
      return null
    case 'stage': {
      // the stage shares the auditorium's room, but only people on stage may speak
      const auditorium = zones.find(
        (other) =>
          other.type === 'auditorium' &&
          findZone([other], zone.x + zone.width / 2, zone.y + zone.height / 2)
      )
      return { room: `zone-${(auditorium ?? zone).id}`, mode: 'everyone', canPublish: true }
    }
    case 'auditorium':
      return { room: `zone-${zone.id}`, mode: 'everyone', canPublish: false }
    case 'meeting':
    case 'focus':
      return { room: `zone-${zone.id}`, mode: 'everyone', canPublish: true }
    default:
      return { room: 'open', mode: 'proximity', canPublish: true }
  }
}
