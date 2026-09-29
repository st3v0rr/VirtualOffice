import { useEffect, useState } from 'react'
import { Html } from '@react-three/drei'
import { useGame } from '../state/game'

// name tag and speech bubble over a chibi's head (DOM, so the text stays crisp)
export default function Tag({
  id,
  name,
  height = 1.6,
}: {
  id: string
  name: string
  height?: number
}) {
  const bubble = useGame((s) => s.bubbles[id])
  // the `until` of the last bubble that ran out
  const [expired, setExpired] = useState(0)
  const visible = bubble && bubble.until !== expired

  useEffect(() => {
    if (!bubble) return
    const timer = window.setTimeout(
      () => setExpired(bubble.until),
      Math.max(0, bubble.until - Date.now())
    )
    return () => window.clearTimeout(timer)
  }, [bubble])

  return (
    <Html position={[0, height, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="tag">
        {visible && (
          <div key={bubble.until} className="bubble">
            {bubble.text}
          </div>
        )}
        <div className="name">{name}</div>
      </div>
    </Html>
  )
}
