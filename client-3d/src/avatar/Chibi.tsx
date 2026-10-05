import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Avatar } from './avatar'
import { flat, gradientMap, toon } from '../toon/materials'
import { outlineThin } from '../toon/outline'
import { chibiGeometry, PIVOTS, type MergedSegment } from './chibiGeometry'
import { useSettings } from '../state/settings'
import { DRINKS, EMOTE_DURATION, SIT_LIFT, type Motion } from './motion'
import { inView } from '../world/view'

// A chibi built from primitives (see chibiGeometry): big round head, small body, stubby legs.
// Units are tiles (1 = 32px of the 2D map); the chibi is about 1.1 tiles tall.
// All animation is procedural and runs in useFrame, driven by a mutable Motion object
// so moving players don't re-render React.

const shadowGeometry = new THREE.CircleGeometry(0.3, 24)
const cupGeometry = new THREE.CylinderGeometry(0.055, 0.045, 0.11, 12)
const cupFillGeometry = new THREE.CylinderGeometry(0.048, 0.048, 0.025, 12)

// the chibis are a bit bigger than a tile, like the 32x48 sprites of the 2D client
export const CHIBI_SCALE = 1.22

const SHADOW = flat('#4b3d5c', 0.22)
// the merged parts carry their colours as vertex colours
const TOON = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap })
const FLAT = new THREE.MeshBasicMaterial({ vertexColors: true })
const noRaycast = () => null

function SegmentMesh({ merged, outline }: { merged: MergedSegment; outline: boolean }) {
  return (
    <>
      {merged.toon && <mesh geometry={merged.toon} material={TOON} />}
      {merged.flat && <mesh geometry={merged.flat} material={FLAT} />}
      {outline && merged.hull && (
        <mesh geometry={merged.hull} material={outlineThin} raycast={noRaycast} />
      )}
    </>
  )
}

type ChibiProps = {
  avatar: Avatar
  motion: Motion
  // random phase, so a group of idle chibis doesn't sway in sync
  seed?: number
}

export default function Chibi({ avatar, motion, seed = 0 }: ChibiProps) {
  const outline = useSettings((s) => s.outlines)
  const root = useRef<THREE.Group>(null)
  const bounce = useRef<THREE.Group>(null)
  const hips = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.Group>(null)
  const cup = useRef<THREE.Group>(null)
  const cupDrink = useRef<string | null>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const walkPhase = useRef(seed * 10)
  const nextBlink = useRef(2 + seed * 3)

  const parts = useMemo(() => chibiGeometry(avatar), [avatar])

  useFrame(({ clock, camera }, delta) => {
    const mo = motion
    if (!root.current || !bounce.current || !hips.current || !head.current) return
    // nobody sees it, so don't animate it (40 chibis in the conference room add up)
    if (!inView(root.current, camera, clock.elapsedTime)) return
    const t = clock.elapsedTime
    const dt = Math.min(delta, 0.1)
    const lerp = (a: number, b: number, k: number) => a + (b - a) * (1 - Math.exp(-k * dt))

    let y = 0
    let squash = 1
    let legSwing = 0
    let armSwingL = 0
    let armSwingR = 0
    let armRaiseL = 0.12
    let armRaiseR = -0.12
    let lean = 0
    let headTilt = Math.sin(t * 0.9 + seed * 6) * 0.05
    let sway = 0
    let legLift = 0
    let headYaw = 0

    if (mo.state === 'walk') {
      walkPhase.current += dt * (7 + 6 * mo.speed)
      const p = walkPhase.current
      y = Math.abs(Math.sin(p)) * 0.075 * (0.4 + 0.6 * mo.speed)
      squash = 1 - 0.05 * Math.cos(2 * p)
      legSwing = Math.sin(p) * 0.75
      armSwingL = -Math.sin(p) * 0.7
      armSwingR = Math.sin(p) * 0.7
      lean = 0.1
      headTilt = Math.sin(p) * 0.06
    } else if (mo.state === 'idle') {
      // wippen: breathe and rock gently from side to side
      const b = Math.sin(t * 2.3 + seed * 5)
      squash = 1 + 0.018 * b
      sway = Math.sin(t * 1.4 + seed * 3) * 0.035
      armSwingL = 0.05 * b
      armSwingR = -0.05 * b
      // standing around for a while: look around now and then, or have a good stretch
      const idle = t - mo.since
      if (idle > 5) {
        const p = (idle + seed * 9) % 9
        if (p < 1.8) {
          headYaw = Math.sin((p / 1.8) * Math.PI * 2) * 0.55
        } else if (p > 5 && p < 6.3 && seed > 0.5) {
          const k = Math.sin(((p - 5) / 1.3) * Math.PI)
          armRaiseL = 0.12 + 2.5 * k
          armRaiseR = -0.12 - 2.5 * k
          squash *= 1 + 0.07 * k
          headTilt = -0.1 * k
        }
      }
    } else {
      // sitting: the "plumps" drops in from a little hop, squashes and wobbles back
      const s = t - mo.since
      const fall = 0.28
      if (s < fall) {
        const k = s / fall
        y = SIT_LIFT + 0.22 * (1 - k * k) + 0.06 * Math.sin(k * Math.PI)
      } else {
        const w = s - fall
        y = SIT_LIFT
        squash = 1 - 0.2 * Math.exp(-7 * w) * Math.cos(w * 18)
      }
      legLift = -1.45
      const b = Math.sin(t * 2 + seed * 5)
      squash *= 1 + 0.012 * b
      // dangling feet
      legSwing = Math.sin(t * 3 + seed * 4) * 0.12
    }

    // a drink in the hand, with a sip every few seconds
    const holding = mo.holding && mo.holding.until > t ? mo.holding : null
    if (mo.holding && !holding) mo.holding = null
    if (holding) {
      armSwingR = -0.5
      armRaiseR = -0.15
      const sip = (t + seed * 4) % 4.5
      if (sip < 0.9) {
        const k = Math.sin((sip / 0.9) * Math.PI)
        armSwingR = -0.5 - 1.6 * k
        armRaiseR = -0.15 + 0.35 * k
        headTilt = 0
        headYaw = 0
      }
    }
    if (cup.current) {
      cup.current.visible = !!holding
      if (holding && cupDrink.current !== holding.drink) {
        cupDrink.current = holding.drink
        const d = DRINKS[holding.drink]
        ;(cup.current.children[0] as THREE.Mesh).material = toon(d.cup)
        ;(cup.current.children[1] as THREE.Mesh).material = toon(d.fill)
      }
    }

    // the raised hand (left, so waving and drinking still work with the right one)
    if (mo.handRaised) {
      armRaiseL = 2.85 + Math.sin(t * 2.6 + seed * 3) * 0.08
      armSwingL = -0.12
      headTilt = -0.08
    }

    // emotes play on top of the base state
    let armSpeed = 12
    if (mo.emote) {
      const e = t - mo.emoteSince
      if (e > EMOTE_DURATION[mo.emote]) {
        mo.emote = null
      } else if (mo.emote === 'clap') {
        // both hands in front of the chest, meeting about three times a second
        const open = Math.abs(Math.sin(e * Math.PI * 2.8))
        armSwingL = armSwingR = -1.15
        armRaiseL = -0.78 + 0.5 * open
        armRaiseR = 0.78 - 0.5 * open
        armSpeed = 40
        headTilt = 0.06 * Math.sin(e * 6)
        squash *= 1 + 0.025 * (1 - open)
      } else if (mo.emote === 'hearts') {
        // hands folded at the chest, swaying happily from side to side
        armSwingL = armSwingR = -0.95
        armRaiseL = -0.62
        armRaiseR = 0.62
        sway = Math.sin(e * 5) * 0.09
        headTilt = 0.18 * Math.sin(e * 5)
        squash *= 1 + 0.04 * Math.sin(e * 10)
      } else if (mo.emote === 'wave') {
        armRaiseR = -1.85 + Math.sin(e * 14) * 0.3
        armSwingR = 0
        headTilt = 0.15
      } else if (mo.emote === 'cheer') {
        armRaiseL = 2.7 + Math.sin(e * 16) * 0.2
        armRaiseR = -2.7 - Math.sin(e * 16) * 0.2
        armSwingL = armSwingR = 0
        if (mo.state !== 'sit') y += Math.abs(Math.sin(e * 8)) * 0.22
        squash *= 1 + 0.06 * Math.sin(e * 16)
      } else if (mo.emote === 'gulp' && mo.state !== 'sit') {
        const k = e / EMOTE_DURATION.gulp
        y += Math.sin(k * Math.PI) * 0.25
        squash *= 1 + 0.12 * Math.sin(k * Math.PI * 2)
      }
    }

    bounce.current.position.y = lerp(
      bounce.current.position.y,
      y,
      mo.state === 'walk' || mo.emote ? 40 : 18
    )
    bounce.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash))
    bounce.current.rotation.z = lerp(bounce.current.rotation.z, sway, 6)
    hips.current.rotation.x = lerp(hips.current.rotation.x, lean, 8)
    head.current.rotation.z = lerp(head.current.rotation.z, headTilt, 8)
    head.current.rotation.y = lerp(head.current.rotation.y, headYaw, 6)

    const legs = [legL.current, legR.current]
    legs.forEach((leg, i) => {
      if (!leg) return
      const swing = i === 0 ? legSwing : -legSwing
      leg.rotation.x = lerp(leg.rotation.x, legLift + swing, 20)
    })
    if (armL.current && armR.current) {
      armL.current.rotation.x = lerp(armL.current.rotation.x, armSwingL, 14)
      armR.current.rotation.x = lerp(armR.current.rotation.x, armSwingR, 14)
      armL.current.rotation.z = lerp(armL.current.rotation.z, armRaiseL, armSpeed)
      armR.current.rotation.z = lerp(armR.current.rotation.z, armRaiseR, armSpeed)
    }

    // blink every few seconds
    if (eyes.current) {
      if (t > nextBlink.current + 0.12) nextBlink.current = t + 2 + ((seed * 7 + t) % 3.5)
      eyes.current.scale.y = t > nextBlink.current ? 0.12 : 1
    }
    if (shadow.current) {
      const s = 1 - Math.min(bounce.current.position.y, 0.3) * 1.2
      shadow.current.scale.setScalar(s)
    }
  })

  return (
    <group ref={root} userData={{ chibi: true }} scale={CHIBI_SCALE}>
      <mesh
        ref={shadow}
        geometry={shadowGeometry}
        material={SHADOW}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 0]}
      />
      <group ref={bounce}>
        {/* legs hang from the hips */}
        <group ref={legL} position={PIVOTS.legL}>
          <SegmentMesh merged={parts.legL} outline={outline} />
        </group>
        <group ref={legR} position={PIVOTS.legR}>
          <SegmentMesh merged={parts.legR} outline={outline} />
        </group>
        <group ref={hips} position={PIVOTS.hips}>
          <SegmentMesh merged={parts.hips} outline={outline} />
          <group ref={armL} position={PIVOTS.armL}>
            <SegmentMesh merged={parts.armL} outline={outline} />
          </group>
          <group ref={armR} position={PIVOTS.armR}>
            <SegmentMesh merged={parts.armR} outline={outline} />
            {/* the cup from the vending machine, shown while holding a drink */}
            <group ref={cup} visible={false} position={[0, -0.21, 0.07]}>
              <mesh geometry={cupGeometry} material={toon('#fff6ea')} />
              <mesh
                geometry={cupFillGeometry}
                material={toon('#8a5a3c')}
                position={[0, 0.045, 0]}
              />
            </group>
          </group>
          {/* the big head */}
          <group ref={head} position={PIVOTS.head}>
            <SegmentMesh merged={parts.head} outline={outline} />
            <group position={PIVOTS.eyes}>
              <group ref={eyes}>
                <SegmentMesh merged={parts.eyes} outline={false} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
