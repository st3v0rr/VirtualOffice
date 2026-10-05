import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Chibi from '../avatar/Chibi'
import { useTagAnchor } from './TagLayer'
import { useGame } from '../state/game'
import { office, toWorld, toMap, chairSitPosition } from '../map/office'
import { move, isFree } from '../map/collision'
import { createPathQueue } from '../map/pathRequestQueue'
import { findPathInWorker } from '../map/pathWorkerTransport'
import { me, toAnim } from '../net/players'
import { network } from '../net/network'
import { intent } from '../game/intent'
import { clock, playEmote, toggleHand } from '../game/actions'
import { emoteForKey, HAND_KEY } from '../game/emotes'
import {
  chairs,
  findNearby,
  approachPoint,
  distanceTo,
  chairOccupant,
  type Interactable,
} from '../game/interactables'

// My chibi: keyboard (WASD/arrows, relative to the screen) and click-to-walk,
// sitting down, using items, sending my position to the server.

const SPEED = 5 // tiles per second (the 2D client: 200 px/s = 6.25)
// the camera looks from the south-east, so "up" on screen is north-west in the world
const SCREEN_UP = new THREE.Vector2(-1, -1).normalize()
const SCREEN_RIGHT = new THREE.Vector2(1, -1).normalize()

const KEYS_UP = ['KeyW', 'ArrowUp']
const KEYS_DOWN = ['KeyS', 'ArrowDown']
const KEYS_LEFT = ['KeyA', 'ArrowLeft']
const KEYS_RIGHT = ['KeyD', 'ArrowRight']

const isTyping = () => {
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  )
}
// the character editor or the settings dialog covers the office: no shortcuts, no walking
const inModal = () => {
  const { editorOpen, settingsOpen } = useGame.getState()
  return editorOpen || settingsOpen
}

const PROMPTS: Record<Interactable['kind'], string> = {
  chair: 'E: Hinsetzen',
  computer: 'R: Computer benutzen',
  vending: 'R: Getränk ziehen',
}

// the shortest way to turn from one angle to another
function turn(from: number, to: number, k: number) {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + diff * k
}

export default function LocalPlayer() {
  const avatar = useGame((s) => s.avatar)
  const sessionId = useGame((s) => s.sessionId)
  const group = useRef<THREE.Group>(null)
  useTagAnchor(sessionId, group)
  const keys = useRef(new Set<string>())
  const path = useRef<{ x: number; z: number }[] | null>(null)
  const pendingUse = useRef<Interactable | null>(null)
  const pathQueue = useRef(createPathQueue(findPathInWorker)).current
  const targetRot = useRef(0)
  const lastPrompt = useRef<string | null>(null)
  // actions from key presses, run in the frame loop
  const actions = useRef<('sit' | 'use')[]>([])

  // start at the spawn point of the map
  useEffect(() => {
    const spawn = toWorld(office.spawn.x, office.spawn.y)
    me.x = spawn.x
    me.z = spawn.z
    me.rot = 0
    me.sittingOn = null
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping() || inModal()) return
      keys.current.add(e.code)
      if (e.repeat) return
      if (e.code === 'KeyE') actions.current.push('sit')
      if (e.code === 'KeyR') actions.current.push('use')
      const emote = emoteForKey(e.code)
      if (emote) playEmote(emote)
      if (e.code === HAND_KEY) toggleHand()
      if (e.code === 'Enter') {
        e.preventDefault()
        useGame.getState().set({ chatFocused: true })
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const clear = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  useFrame(({ clock: c }, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.1)
    const now = c.elapsedTime
    clock.now = now
    const motion = me.motion
    const game = useGame.getState()

    const sitOn = (chairId: string) => {
      const chair = chairs.find((ch) => ch.id === chairId)
      if (!chair || chairOccupant(chairId)) return
      me.sittingOn = chairId
      me.x = chair.x
      me.z = chair.z
      targetRot.current = chair.rot
      motion.state = 'sit'
      motion.since = now
      pathQueue.cancel()
      path.current = null
      pendingUse.current = null
    }
    const standUp = () => {
      const chair = chairs.find((ch) => ch.id === me.sittingOn)
      me.sittingOn = null
      motion.state = 'idle'
      motion.since = now
      if (!chair) return
      // step off the chair to the front if there is room
      for (const dist of [0.55, 0.35, -0.5, 0]) {
        const x = chair.x + Math.sin(chair.rot) * dist
        const z = chair.z + Math.cos(chair.rot) * dist
        if (isFree(x, z)) {
          me.x = x
          me.z = z
          return
        }
      }
    }
    const activate = (item: Interactable) => {
      if (item.kind === 'chair') {
        if (chairOccupant(item.id) && me.sittingOn !== item.id) {
          game.set({ prompt: 'Der Stuhl ist besetzt' })
          lastPrompt.current = null
          return
        }
        sitOn(item.id)
      } else {
        // face the item and open its dialog
        targetRot.current = Math.atan2(item.x - me.x, item.z - me.z)
        if (item.kind === 'vending') game.set({ dialog: { kind: 'vending' } })
        else game.set({ dialog: { kind: item.kind, id: item.id } })
      }
    }

    // ---- requests from clicks and keys ----
    if (intent.use) {
      const item = intent.use
      intent.use = null
      if (item.kind === 'chair' && me.sittingOn === item.id) {
        standUp()
      } else {
        if (me.sittingOn && item.kind === 'chair') standUp()
        const reach = item.kind === 'chair' ? 0.05 : 0.6
        if (me.sittingOn || distanceTo(item, me.x, me.z) <= reach) {
          activate(item)
        } else {
          const target = approachPoint(item, me.x, me.z)
          pathQueue.request(me.x, me.z, target.x, target.z, (result) => {
            path.current = result
            pendingUse.current = result ? item : null
          })
        }
      }
    }
    if (intent.walkTo) {
      const { x, z } = intent.walkTo
      intent.walkTo = null
      if (me.sittingOn) standUp()
      pathQueue.request(me.x, me.z, x, z, (result) => {
        path.current = result
        pendingUse.current = null
      })
    }
    for (const action of actions.current.splice(0)) {
      const nearby = findNearby(me.x, me.z, me.rot, !!me.sittingOn)
      if (action === 'sit') {
        if (me.sittingOn) standUp()
        else if (nearby?.kind === 'chair') sitOn(nearby.id)
      } else if (nearby && nearby.kind !== 'chair') {
        activate(nearby)
      }
    }

    // ---- movement ----
    const k = keys.current
    const input = new THREE.Vector2()
    const typing = isTyping() || inModal()
    if (!typing) {
      if (KEYS_UP.some((key) => k.has(key))) input.add(SCREEN_UP)
      if (KEYS_DOWN.some((key) => k.has(key))) input.sub(SCREEN_UP)
      if (KEYS_RIGHT.some((key) => k.has(key))) input.add(SCREEN_RIGHT)
      if (KEYS_LEFT.some((key) => k.has(key))) input.sub(SCREEN_RIGHT)
    }

    let vx = 0
    let vz = 0
    if (input.lengthSq() > 0) {
      pathQueue.cancel()
      path.current = null
      pendingUse.current = null
      if (me.sittingOn) standUp()
      const strength = Math.min(1, input.length())
      input.normalize().multiplyScalar(strength)
      vx = input.x
      vz = input.y
    } else if (path.current && !me.sittingOn) {
      const next = path.current[0]
      const dx = next.x - me.x
      const dz = next.z - me.z
      const dist = Math.hypot(dx, dz)
      if (dist < SPEED * dt) {
        me.x = next.x
        me.z = next.z
        path.current.shift()
        if (!path.current.length) {
          path.current = null
          const item = pendingUse.current
          pendingUse.current = null
          if (item) activate(item)
        }
      } else {
        vx = dx / dist
        vz = dz / dist
      }
    }

    const moving = vx !== 0 || vz !== 0
    if (moving) {
      const before = { x: me.x, z: me.z }
      const after = move(me.x, me.z, vx * SPEED * dt, vz * SPEED * dt)
      me.x = after.x
      me.z = after.z
      targetRot.current = Math.atan2(vx, vz)
      // stuck on a click-to-walk path (someone else's desk moved?) -> give up
      if (path.current && Math.hypot(after.x - before.x, after.z - before.z) < 1e-4)
        path.current = null
    }
    me.rot = turn(me.rot, targetRot.current, 1 - Math.exp(-14 * dt))

    if (!me.sittingOn) {
      const state = moving ? 'walk' : 'idle'
      if (motion.state !== state) {
        motion.state = state
        motion.since = now
      }
      motion.speed = moving ? Math.min(1, Math.hypot(vx, vz)) : 0
    }

    g.position.set(me.x, 0, me.z)
    g.rotation.y = me.rot

    // ---- network ----
    if (sessionId) {
      const texture = avatar.texture
      const chair = me.sittingOn ? chairs.find((ch) => ch.id === me.sittingOn) : undefined
      if (chair) {
        const pos = chairSitPosition(chair.chair)
        network.sendPlayer({
          x: pos.x,
          y: pos.y,
          anim: toAnim(texture, 'sit', me.rot, chair.chair.dir),
          rot: chair.rot,
        })
      } else {
        const pos = toMap(me.x, me.z)
        network.sendPlayer({
          ...pos,
          anim: toAnim(texture, motion.state, me.rot),
          rot: Math.round(me.rot * 100) / 100,
        })
      }
    }

    // ---- hint for the item in front of me ----
    const nearby = findNearby(me.x, me.z, me.rot, !!me.sittingOn)
    const prompt = me.sittingOn
      ? nearby && nearby.kind !== 'chair'
        ? `${PROMPTS[nearby.kind]} · E: Aufstehen`
        : 'E: Aufstehen'
      : nearby
        ? PROMPTS[nearby.kind]
        : null
    if (prompt !== lastPrompt.current) {
      lastPrompt.current = prompt
      game.set({ prompt })
    }
  })

  return (
    <group ref={group}>
      <Chibi avatar={avatar} motion={me.motion} />
    </group>
  )
}
