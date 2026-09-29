import { useRef, useState } from 'react'
import { joystick } from '../game/intent'

// on touch screens: a thumb stick in the bottom right corner (screen directions)
const RADIUS = 48

export default function Joystick() {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const origin = useRef<{ x: number; y: number } | null>(null)

  const update = (x: number, y: number) => {
    const o = origin.current
    if (!o) return
    let dx = x - o.x
    let dy = y - o.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    setKnob({ x: dx, y: dy })
    // dead zone in the middle, full speed from half way out
    const strength = Math.min(1, Math.max(0, (len - 8) / (RADIUS / 2)))
    joystick.x = len ? (dx / Math.hypot(dx, dy)) * strength : 0
    joystick.y = len ? (-dy / Math.hypot(dx, dy)) * strength : 0
  }
  const release = () => {
    origin.current = null
    joystick.x = 0
    joystick.y = 0
    setKnob({ x: 0, y: 0 })
  }

  return (
    <div
      className="joystick"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const rect = e.currentTarget.getBoundingClientRect()
        origin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        update(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => update(e.clientX, e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}
