import { useEffect } from 'react'
import { useGame } from '../state/game'
import { network } from '../net/network'

// Video/audio run through LiveKit, which isn't wired into the 3D client yet. This only
// checks whether media would be possible here, and says so, so the office stays usable
// without a LiveKit server.
async function checkMedia() {
  const set = useGame.getState().set
  set({ media: 'checking' })
  try {
    const grant = await network.requestMediaGrant()
    if (!grant) {
      set({ media: 'quiet', mediaDetail: 'Ruhezone: hier gibt es kein Video' })
      return
    }
    // is the LiveKit server reachable at all?
    const url = grant.url.replace(/^ws/, 'http')
    await fetch(url, { mode: 'no-cors', signal: AbortSignal.timeout(2500) })
    set({
      media: 'available',
      mediaDetail: `LiveKit erreichbar (${grant.url}); Video im 3D-PoC noch nicht angebunden`,
    })
  } catch (error) {
    set({
      media: 'unavailable',
      mediaDetail: `Medien nicht verfügbar: ${(error as Error).message || 'LiveKit nicht erreichbar'}`,
    })
  }
}

const TEXT = {
  unknown: '🎥 …',
  checking: '🎥 prüfe …',
  available: '🎥 Medien bereit',
  unavailable: '🎥 Medien nicht verfügbar',
  quiet: '🤫 Ruhezone',
}

export default function MediaBadge() {
  const media = useGame((s) => s.media)
  const detail = useGame((s) => s.mediaDetail)
  useEffect(() => {
    checkMedia()
  }, [])
  return (
    <button className={`pill button media-${media}`} title={detail} onClick={checkMedia}>
      {TEXT[media]}
    </button>
  )
}
