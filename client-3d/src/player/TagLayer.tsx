import { useEffect, useState, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/game'
import { ROOM_LABELS } from '../world/rooms'

// Name tags, speech bubbles and room signs as DOM on top of the canvas (so the text is
// crisp and cheap). They are plain elements of the app positioned in one loop, instead
// of a drei <Html> (a React root and a frame callback) per player.

const TAG_HEIGHT = 1.6
const anchors = new Map<string, THREE.Object3D>()

// the chibi group a player's tag follows
export function useTagAnchor(id: string | undefined, ref: RefObject<THREE.Object3D | null>) {
  useEffect(() => {
    const object = ref.current
    if (!id || !object) return
    anchors.set(id, object)
    return () => {
      if (anchors.get(id) === object) anchors.delete(id)
    }
  }, [id, ref])
}

function Bubble({ id }: { id: string }) {
  const bubble = useGame((s) => s.bubbles[id])
  // the `until` of the last bubble that ran out
  const [expired, setExpired] = useState(0)
  useEffect(() => {
    if (!bubble) return
    const timer = window.setTimeout(
      () => setExpired(bubble.until),
      Math.max(0, bubble.until - Date.now())
    )
    return () => window.clearTimeout(timer)
  }, [bubble])
  if (!bubble || bubble.until === expired) return null
  return (
    <div key={bubble.until} className="bubble">
      {bubble.text}
    </div>
  )
}

// the DOM elements of the tags, filled by <TagOverlay>, positioned by <TagProjector>
const tagElements = new Map<string, HTMLDivElement>()
const labelElements: (HTMLDivElement | null)[] = []
const v = new THREE.Vector3()
const placed = new WeakMap<HTMLDivElement, { px: number; py: number; hidden: boolean }>()

// inside the canvas: moves the tags to their chibis every frame
export function TagProjector() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  const place = (el: HTMLDivElement, x: number, y: number, z: number) => {
    v.set(x, y, z).project(camera)
    const hidden = v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.2
    const px = Math.round(((v.x + 1) / 2) * size.width * 2) / 2
    const py = Math.round(((1 - v.y) / 2) * size.height * 2) / 2
    // touching the DOM only when something changed saves style recalculations, e.g.
    // for a room full of people sitting still
    const last = placed.get(el)
    if (last && last.hidden === hidden && (hidden || (last.px === px && last.py === py))) return
    placed.set(el, { px, py, hidden })
    el.style.visibility = hidden ? 'hidden' : 'visible'
    if (!hidden) el.style.transform = `translate3d(${px}px, ${py}px, 0)`
  }

  // runs after the camera rig because it is mounted after it (a priority > 0 would
  // switch off react-three-fiber's automatic rendering)
  useFrame(() => {
    for (const [id, el] of tagElements) {
      const anchor = anchors.get(id)
      if (!anchor) {
        placed.delete(el)
        el.style.visibility = 'hidden'
        continue
      }
      const p = anchor.getWorldPosition(v)
      place(el, p.x, p.y + TAG_HEIGHT, p.z)
    }
    ROOM_LABELS.forEach((label, i) => {
      const el = labelElements[i]
      if (el) place(el, label.x, 0.05, label.z)
    })
  })
  return null
}

// outside the canvas: the DOM of all tags and room signs
export function TagOverlay() {
  const players = useGame((s) => s.players)
  const sessionId = useGame((s) => s.sessionId)
  const myName = useGame((s) => s.name)

  const entries: [string, string][] = Object.entries(players).map(([id, p]) => [id, p.name])
  if (sessionId) entries.push([sessionId, myName])

  const setTag = (id: string) => (el: HTMLDivElement | null) => {
    if (el) tagElements.set(id, el)
    else tagElements.delete(id)
  }

  return (
    <div className="tag-layer">
      {ROOM_LABELS.map((label, i) => (
        <div key={label.name} className="anchor" ref={(el) => void (labelElements[i] = el)}>
          <div className="room-label">{label.name}</div>
        </div>
      ))}
      {entries.map(([id, name]) => (
        <div key={id} className="anchor" ref={setTag(id)}>
          <div className="tag">
            <Bubble id={id} />
            <div className="name">{name}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
