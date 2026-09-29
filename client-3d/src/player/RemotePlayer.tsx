import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Chibi from '../avatar/Chibi'
import Tag from './Tag'
import { createMotion } from '../avatar/motion'
import type { Avatar } from '../avatar/avatar'
import { remotes } from '../net/players'
import { chairs } from '../game/interactables'

// Another player: glides towards the last position from the server and plays the
// animation its anim/state says. Players of the 2D client show up as their preset chibi.

const TELEPORT_DISTANCE = 4

export default function RemotePlayer({
  id,
  name,
  avatar,
}: {
  id: string
  name: string
  avatar: Avatar
}) {
  const group = useRef<THREE.Group>(null)
  const [motion] = useState(createMotion)
  const [seed] = useState(() => Math.random())

  useFrame(({ clock }, delta) => {
    const g = group.current
    const remote = remotes.get(id)
    if (!g || !remote) return
    const dt = Math.min(delta, 0.1)
    const now = clock.elapsedTime

    let tx = remote.targetX
    let tz = remote.targetZ
    let rot = remote.rot
    // snap sitting players onto the seat of their chair (the 2D client shifts them a bit)
    if (remote.state === 'sit') {
      let best = 0.6
      for (const chair of chairs) {
        const d = Math.hypot(chair.x - tx, chair.z - tz)
        if (d < best) {
          best = d
          tx = chair.x
          tz = chair.z
          rot = chair.rot
        }
      }
    }

    const dx = tx - g.position.x
    const dz = tz - g.position.z
    const dist = Math.hypot(dx, dz)
    if (remote.fresh || dist > TELEPORT_DISTANCE) {
      g.position.set(tx, 0, tz)
      g.rotation.y = rot
      remote.fresh = false
    } else {
      // exponential smoothing hides the 15 Hz updates
      const k = 1 - Math.exp(-12 * dt)
      g.position.x += dx * k
      g.position.z += dz * k
      const diff = Math.atan2(Math.sin(rot - g.rotation.y), Math.cos(rot - g.rotation.y))
      g.rotation.y += diff * (1 - Math.exp(-12 * dt))
    }

    // walking is what the anim says, but stop the legs once the chibi arrived
    const state = remote.state === 'walk' && dist < 0.02 ? 'idle' : remote.state
    if (motion.state !== state) {
      motion.state = state
      motion.since = now
    }
    motion.speed = state === 'walk' ? 1 : 0

    if (remote.emote) {
      motion.emote = remote.emote
      motion.emoteSince = now
      remote.emote = null
    }
  })

  return (
    <group ref={group}>
      <Chibi avatar={avatar} motion={motion} seed={seed} />
      <Tag id={id} name={name} />
    </group>
  )
}
