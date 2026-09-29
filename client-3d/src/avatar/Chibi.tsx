import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Avatar } from './avatar'
import { flat, toon } from '../toon/materials'
import { Hull } from '../toon/outline'
import { useSettings } from '../state/settings'
import { EMOTE_DURATION, SIT_LIFT, type Motion } from './motion'
import { inView } from '../world/view'

// A chibi built from primitives: big round head, small body, stubby legs.
// Units are tiles (1 = 32px of the 2D map); the chibi is about 1.1 tiles tall.
// All animation is procedural and runs in useFrame, driven by a mutable Motion object
// so moving players don't re-render React.

// shared geometries, every chibi uses the same ones
const sphere = new THREE.SphereGeometry(1, 18, 12)
const sphereLow = new THREE.SphereGeometry(1, 10, 7)
const legGeometry = new THREE.CapsuleGeometry(0.068, 0.07, 4, 10)
const armGeometry = new THREE.CapsuleGeometry(0.05, 0.11, 4, 10)
const skirtGeometry = new THREE.CylinderGeometry(0.17, 0.25, 0.17, 18)
const hairCapGeometry = new THREE.SphereGeometry(0.33, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56)
const bobGeometry = new THREE.SphereGeometry(
  0.345,
  22,
  14,
  Math.PI * 0.12,
  Math.PI * 1.76,
  0,
  Math.PI * 0.68
)
const spikeGeometry = new THREE.ConeGeometry(0.075, 0.2, 8)
const mouthGeometry = new THREE.TorusGeometry(0.034, 0.01, 6, 14, Math.PI)
const hoodGeometry = new THREE.TorusGeometry(0.17, 0.065, 8, 20)
const collarGeometry = new THREE.TorusGeometry(0.13, 0.03, 6, 20)
const shadowGeometry = new THREE.CircleGeometry(0.3, 24)

// the chibis are a bit bigger than a tile, like the 32x48 sprites of the 2D client
export const CHIBI_SCALE = 1.22

const EYE_COLOR = '#2e2433'
const SHOE_COLOR = '#5a4a5e'
const BLUSH = flat('#ff8fa6', 0.55)
const SHADOW = flat('#4b3d5c', 0.22)

type PartProps = {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  position?: [number, number, number]
  scale?: number | [number, number, number]
  rotation?: [number, number, number]
  outline: boolean
  children?: ReactNode
}

function Part({ geometry, material, outline, children, ...transform }: PartProps) {
  return (
    <mesh geometry={geometry} material={material} {...transform}>
      {outline && <Hull geometry={geometry} />}
      {children}
    </mesh>
  )
}

function Hair({ avatar, outline }: { avatar: Avatar; outline: boolean }) {
  const m = toon(avatar.hairColor)
  const cap = (
    <Part geometry={hairCapGeometry} material={m} rotation={[-0.42, 0, 0]} outline={outline} />
  )
  // a fringe of little bumps over the forehead
  const bangs = [-0.15, -0.05, 0.05, 0.15].map((x, i) => (
    <Part
      key={i}
      geometry={sphereLow}
      material={m}
      position={[x, 0.17 - Math.abs(x) * 0.25, 0.235 - Math.abs(x) * 0.25]}
      scale={[0.085, 0.07, 0.06]}
      outline={false}
    />
  ))
  switch (avatar.hair) {
    case 'bob':
      return (
        <group>
          <Part
            geometry={bobGeometry}
            material={m}
            rotation={[-0.2, Math.PI, 0]}
            outline={outline}
          />
          {bangs}
        </group>
      )
    case 'spiky':
      return (
        <group>
          {cap}
          {[
            [0, 0.3, 0.02, 0, 0],
            [0.13, 0.26, 0.05, -0.2, -0.55],
            [-0.13, 0.26, 0.05, 0.2, 0.55],
            [0.06, 0.24, -0.16, -0.7, -0.25],
            [-0.08, 0.24, -0.16, -0.7, 0.3],
            [0, 0.22, 0.2, 0.7, 0],
          ].map(([x, y, z, rx, rz], i) => (
            <Part
              key={i}
              geometry={spikeGeometry}
              material={m}
              position={[x, y, z]}
              rotation={[rx, 0, rz]}
              outline={outline}
            />
          ))}
          {bangs}
        </group>
      )
    case 'pigtails':
      return (
        <group>
          <Part
            geometry={bobGeometry}
            material={m}
            rotation={[-0.2, Math.PI, 0]}
            outline={outline}
          />
          {bangs}
          {[1, -1].map((side) => (
            <group key={side} position={[side * 0.33, 0.02, -0.06]}>
              <Part
                geometry={sphere}
                material={m}
                scale={[0.1, 0.13, 0.1]}
                position={[side * 0.04, -0.06, 0]}
                outline={outline}
              />
              <Part
                geometry={sphereLow}
                material={toon('#ff8fb1')}
                scale={0.045}
                position={[-side * 0.03, 0.05, 0]}
                outline={false}
              />
            </group>
          ))}
        </group>
      )
    case 'bun':
      return (
        <group>
          {cap}
          {bangs}
          <Part
            geometry={sphere}
            material={m}
            position={[0, 0.3, -0.1]}
            scale={0.13}
            outline={outline}
          />
        </group>
      )
  }
}

function Face({ blinkRef }: { blinkRef: RefObject<THREE.Group | null> }) {
  return (
    <group>
      <group ref={blinkRef}>
        {[1, -1].map((side) => (
          <group key={side} position={[side * 0.112, -0.015, 0.268]} rotation={[0, side * 0.38, 0]}>
            <mesh geometry={sphereLow} material={flat(EYE_COLOR)} scale={[0.052, 0.074, 0.035]} />
            <mesh
              geometry={sphereLow}
              material={flat('#ffffff')}
              scale={0.02}
              position={[0.018, 0.028, 0.028]}
            />
          </group>
        ))}
      </group>
      {[1, -1].map((side) => (
        <mesh
          key={side}
          geometry={sphereLow}
          material={BLUSH}
          position={[side * 0.19, -0.085, 0.225]}
          rotation={[0, side * 0.7, 0]}
          scale={[0.055, 0.03, 0.02]}
        />
      ))}
      <mesh
        geometry={mouthGeometry}
        material={flat('#7a3b4a')}
        position={[0, -0.1, 0.285]}
        rotation={[0.25, 0, Math.PI]}
      />
    </group>
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
  const shadow = useRef<THREE.Mesh>(null)
  const walkPhase = useRef(seed * 10)
  const nextBlink = useRef(2 + seed * 3)

  const m = useMemo(
    () => ({
      skin: toon(avatar.skin),
      top: toon(avatar.topColor),
      bottom: toon(avatar.bottomColor),
      shoe: toon(SHOE_COLOR),
      accent: toon('#fff6ea'),
    }),
    [avatar]
  )

  useFrame(({ clock }, delta) => {
    const mo = motion
    if (!root.current || !bounce.current || !hips.current || !head.current) return
    // nobody sees it, so don't animate it (40 chibis in the conference room add up)
    if (!inView(root.current)) return
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

    // emotes play on top of the base state
    if (mo.emote) {
      const e = t - mo.emoteSince
      if (e > EMOTE_DURATION[mo.emote]) {
        mo.emote = null
      } else if (mo.emote === 'wave') {
        armRaiseR = -2.55 + Math.sin(e * 14) * 0.35
        armSwingR = 0
        headTilt = 0.15
      } else if (mo.emote === 'cheer') {
        armRaiseL = 2.7 + Math.sin(e * 16) * 0.2
        armRaiseR = -2.7 - Math.sin(e * 16) * 0.2
        armSwingL = armSwingR = 0
        if (mo.state !== 'sit') y += Math.abs(Math.sin(e * 8)) * 0.22
        squash *= 1 + 0.06 * Math.sin(e * 16)
      } else if (mo.emote === 'hop' && mo.state !== 'sit') {
        const k = e / EMOTE_DURATION.hop
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

    const legs = [legL.current, legR.current]
    legs.forEach((leg, i) => {
      if (!leg) return
      const swing = i === 0 ? legSwing : -legSwing
      leg.rotation.x = lerp(leg.rotation.x, legLift + swing, 20)
    })
    if (armL.current && armR.current) {
      armL.current.rotation.x = lerp(armL.current.rotation.x, armSwingL, 14)
      armR.current.rotation.x = lerp(armR.current.rotation.x, armSwingR, 14)
      armL.current.rotation.z = lerp(armL.current.rotation.z, armRaiseL, 12)
      armR.current.rotation.z = lerp(armR.current.rotation.z, armRaiseR, 12)
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

  const legColor = avatar.bottom === 'pants' ? m.bottom : m.skin
  const armColor = avatar.top === 'tshirt' ? m.skin : m.top

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
        {[
          [legL, 1],
          [legR, -1],
        ].map(([ref, side]) => (
          <group
            key={side as number}
            ref={ref as RefObject<THREE.Group>}
            position={[(side as number) * 0.085, 0.2, 0]}
          >
            <Part
              geometry={legGeometry}
              material={legColor}
              position={[0, -0.09, 0]}
              outline={outline}
            />
            <Part
              geometry={sphereLow}
              material={m.shoe}
              position={[0, -0.18, 0.025]}
              scale={[0.078, 0.055, 0.105]}
              outline={outline}
            />
          </group>
        ))}
        <group ref={hips} position={[0, 0.2, 0]}>
          {/* bottom */}
          {avatar.bottom === 'skirt' ? (
            <Part
              geometry={skirtGeometry}
              material={m.bottom}
              position={[0, 0.02, 0]}
              outline={outline}
            />
          ) : (
            <Part
              geometry={sphere}
              material={m.bottom}
              position={[0, 0.04, 0]}
              scale={[0.19, 0.1, 0.16]}
              outline={outline}
            />
          )}
          {avatar.bottom === 'shorts' &&
            [1, -1].map((side) => (
              <Part
                key={side}
                geometry={sphereLow}
                material={m.bottom}
                position={[side * 0.085, -0.02, 0]}
                scale={[0.085, 0.07, 0.085]}
                outline={false}
              />
            ))}
          {/* torso */}
          <Part
            geometry={sphere}
            material={m.top}
            position={[0, 0.15, 0]}
            scale={[0.185, 0.19, 0.155]}
            outline={outline}
          />
          {avatar.top === 'hoodie' && (
            <>
              <Part
                geometry={hoodGeometry}
                material={m.top}
                position={[0, 0.29, -0.09]}
                rotation={[1.2, 0, 0]}
                outline={outline}
              />
              <mesh
                geometry={sphereLow}
                material={toon(avatar.topColor)}
                position={[0, 0.09, 0.135]}
                scale={[0.1, 0.05, 0.03]}
              />
              {[1, -1].map((side) => (
                <mesh
                  key={side}
                  geometry={sphereLow}
                  material={m.accent}
                  position={[side * 0.045, 0.22, 0.14]}
                  scale={[0.012, 0.045, 0.012]}
                />
              ))}
            </>
          )}
          {avatar.top === 'sweater' && (
            <Part
              geometry={collarGeometry}
              material={m.accent}
              position={[0, 0.3, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              outline={false}
            />
          )}
          {/* arms */}
          {[
            [armL, 1],
            [armR, -1],
          ].map(([ref, side]) => (
            <group
              key={side as number}
              ref={ref as RefObject<THREE.Group>}
              position={[(side as number) * 0.175, 0.25, 0]}
            >
              {avatar.top === 'tshirt' && (
                <Part
                  geometry={sphereLow}
                  material={m.top}
                  position={[0, -0.03, 0]}
                  scale={0.068}
                  outline={outline}
                />
              )}
              <Part
                geometry={armGeometry}
                material={armColor}
                position={[0, -0.1, 0]}
                outline={outline}
              />
              <Part
                geometry={sphereLow}
                material={m.skin}
                position={[0, -0.19, 0]}
                scale={0.058}
                outline={outline}
              />
            </group>
          ))}
          {/* the big head */}
          <group ref={head} position={[0, 0.31, 0]}>
            <group position={[0, 0.27, 0]}>
              <Part
                geometry={sphere}
                material={m.skin}
                scale={[1.04 * 0.3, 0.95 * 0.3, 0.3]}
                outline={outline}
              />
              {[1, -1].map((side) => (
                <Part
                  key={side}
                  geometry={sphereLow}
                  material={m.skin}
                  position={[side * 0.3, -0.02, 0]}
                  scale={[0.05, 0.065, 0.045]}
                  outline={false}
                />
              ))}
              <Face blinkRef={eyes} />
              <Hair avatar={avatar} outline={outline} />
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
