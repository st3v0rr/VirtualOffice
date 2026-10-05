import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { flat, pastel } from '../toon/materials'
import { useGame } from '../state/game'
import { chairs, computers, vendingMachines, type Interactable } from '../game/interactables'
import { intent } from '../game/intent'
import { Box, Cyl, Instanced, cylinder, roundedBox, type Instance } from './parts'

// The usable things of the office. Clicking one walks there and uses it.

const setCursor = (pointer: boolean) => {
  document.body.style.cursor = pointer ? 'pointer' : ''
}

function use(item: Interactable) {
  return (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    intent.use = item
  }
}

const hover = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), setCursor(true)),
  onPointerOut: () => setCursor(false),
}

// ---------- chairs: 79 of them, so every part is one instanced mesh ----------

const SEAT_Y = 0.28
const seatGeometry = roundedBox(0.48, 0.1, 0.46, 0.04)
const backGeometry = roundedBox(0.46, 0.4, 0.09, 0.04)
const poleGeometry = cylinder(0.04, 0.04, SEAT_Y - 0.05, 8)
const baseGeometry = cylinder(0.18, 0.2, 0.05, 12)

function rotate(x: number, z: number, angle: number): [number, number] {
  return [x * Math.cos(angle) + z * Math.sin(angle), -x * Math.sin(angle) + z * Math.cos(angle)]
}

export function Chairs() {
  const parts = useMemo(() => {
    const seats: Instance[] = []
    const backs: Instance[] = []
    const poles: Instance[] = []
    const bases: Instance[] = []
    for (const c of chairs) {
      const color = pastel(c.chair.color, 0.4)
      const [bx, bz] = rotate(0, -0.22, c.rot)
      seats.push({ position: [c.x, SEAT_Y, c.z], rotation: c.rot, color })
      backs.push({ position: [c.x + bx, SEAT_Y + 0.22, c.z + bz], rotation: c.rot, color })
      poles.push({ position: [c.x, (SEAT_Y - 0.05) / 2 + 0.02, c.z] })
      bases.push({ position: [c.x, 0.025, c.z] })
    }
    return { seats, backs, poles, bases }
  }, [])

  const events = {
    onClick: (i: number) => (intent.use = chairs[i]),
    onPointerOver: () => setCursor(true),
    onPointerOut: () => setCursor(false),
  }
  return (
    <group>
      <Instanced geometry={seatGeometry} instances={parts.seats} {...events} />
      <Instanced geometry={backGeometry} instances={parts.backs} {...events} />
      <Instanced geometry={poleGeometry} instances={parts.poles} color="#b8b2c8" outline={false} />
      <Instanced geometry={baseGeometry} instances={parts.bases} color="#9e98b0" />
    </group>
  )
}

// ---------- computers: a desk with a monitor for every chair facing it ----------

const screenIdle = flat('#bfe3ff')
const screenBusy = flat('#fff1a8')

// a screen shared at the computer as a texture. The monitor is only ~100 px big on
// screen, so the video is drawn into a small canvas at most SCREEN_FPS times a second
// instead of uploading every full-size frame; the rest of the scene isn't slowed down.
const SCREEN_WIDTH = 480
const SCREEN_HEIGHT = 256
const SCREEN_FPS = 15

function useScreenTexture(stream: MediaStream | undefined) {
  const texture = useMemo(() => {
    if (!stream) return null
    const canvas = document.createElement('canvas')
    canvas.width = SCREEN_WIDTH
    canvas.height = SCREEN_HEIGHT
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [stream])
  useEffect(() => {
    if (!texture || !stream) return
    const canvas = texture.image as HTMLCanvasElement
    const context = canvas.getContext('2d')!
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    video.play().catch(() => {})
    let last = 0
    let handle = 0
    const draw = () => {
      const now = performance.now()
      if (now - last >= 1000 / SCREEN_FPS && video.videoWidth) {
        last = now
        context.drawImage(video, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
        texture.needsUpdate = true
      }
      handle = video.requestVideoFrameCallback(draw)
    }
    handle = video.requestVideoFrameCallback(draw)
    return () => {
      video.cancelVideoFrameCallback(handle)
      video.pause()
      video.srcObject = null
      texture.dispose()
    }
  }, [texture, stream])
  return texture
}

type MonitorProps = {
  x: number
  z: number
  rot: number
  busy: boolean
  screen: THREE.Texture | null
}

function Monitor({ x, z, rot, busy, screen }: MonitorProps) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Box size={[0.06, 0.22, 0.06]} position={[0, 0.8, -0.02]} color="#9e98b0" outline={false} />
      <Box size={[0.32, 0.03, 0.2]} position={[0, 0.7, -0.02]} color="#9e98b0" outline={false} />
      <Box size={[0.95, 0.56, 0.07]} position={[0, 1.1, 0]} color="#5d6b8a" radius={0.03} />
      <mesh
        geometry={roundedBox(0.84, 0.45, 0.02, 0.01)}
        material={busy ? screenBusy : screenIdle}
        position={[0, 1.1, 0.04]}
      />
      {screen && (
        <mesh position={[0, 1.1, 0.052]}>
          <planeGeometry args={[0.82, 0.43]} />
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>
      )}
      <Box
        size={[0.7, 0.03, 0.22]}
        position={[0, 0.7, 0.42]}
        color="#f5f0e6"
        radius={0.01}
        outline={false}
      />
    </group>
  )
}

export function Computers() {
  const itemUsers = useGame((s) => s.itemUsers)
  const screens = useGame((s) => s.screens)
  const layout = useMemo(
    () =>
      computers.map((computer) => {
        const { rect } = computer
        // a monitor faces every chair that looks at this desk
        const sides = new Set<'north' | 'south'>()
        for (const c of chairs) {
          const nearX = c.x > rect.x - 0.2 && c.x < rect.x + rect.w + 0.2
          if (!nearX) continue
          if (c.z > rect.y + rect.h - 0.2 && c.z < rect.y + rect.h + 1.3 && c.chair.dir === 'up')
            sides.add('south')
          if (c.z < rect.y + 0.2 && c.z > rect.y - 1.3 && c.chair.dir === 'down') sides.add('north')
        }
        if (!sides.size) sides.add('south')
        return { computer, sides: [...sides] }
      }),
    []
  )

  return (
    <group>
      {layout.map(({ computer, sides }) => (
        <Desk
          key={computer.id}
          computer={computer}
          sides={sides}
          busy={(itemUsers[computer.id]?.length ?? 0) > 0}
          stream={screens[computer.id]}
        />
      ))}
    </group>
  )
}

type DeskProps = {
  computer: (typeof computers)[number]
  sides: ('north' | 'south')[]
  busy: boolean
  stream: MediaStream | undefined
}

function Desk({ computer, sides, busy, stream }: DeskProps) {
  const screen = useScreenTexture(stream)
  const { rect } = computer
  const w = rect.w - 0.15
  const d = rect.h - 0.25
  return (
    <group onClick={use(computer)} {...hover}>
      <group position={[computer.x, 0, computer.z]}>
        <Box size={[w, 0.08, d]} position={[0, 0.64, 0]} color="#f7e3c4" radius={0.03} />
        <Box
          size={[0.08, 0.6, d - 0.1]}
          position={[-w / 2 + 0.1, 0.3, 0]}
          color="#e6e1ee"
          outline={false}
        />
        <Box
          size={[0.08, 0.6, d - 0.1]}
          position={[w / 2 - 0.1, 0.3, 0]}
          color="#e6e1ee"
          outline={false}
        />
        {/* a small pastel divider between the desks */}
        <Box
          size={[0.06, 0.35, d]}
          position={[w / 2 + 0.05, 0.85, 0]}
          color="#cfe0f5"
          outline={false}
        />
      </group>
      {/* back to back, so the screens of both sides can be seen */}
      {sides.map((side) =>
        side === 'south' ? (
          <Monitor
            key={side}
            x={computer.x}
            z={computer.z + 0.12}
            rot={0}
            busy={busy}
            screen={screen}
          />
        ) : (
          <Monitor
            key={side}
            x={computer.x}
            z={computer.z - 0.12}
            rot={Math.PI}
            busy={busy}
            screen={screen}
          />
        )
      )}
    </group>
  )
}

// ---------- the vending machine ----------

const CAN_COLORS = ['#ff9aa2', '#ffd48a', '#b5e8a3', '#8fd3e8', '#c9a7f5']
const canGeometry = cylinder(0.045, 0.045, 0.12, 10)

export function VendingMachines() {
  return (
    <group>
      {vendingMachines.map((machine) => {
        const { rect } = machine
        const w = rect.w - 0.05
        const d = Math.max(rect.h - 0.05, 0.5)
        return (
          <group
            key={machine.id}
            position={[machine.x, 0, machine.z]}
            onClick={use(machine)}
            {...hover}
          >
            <Box size={[w, 1.75, d]} position={[0, 0.875, 0]} color="#ffb3c6" radius={0.08} />
            <mesh
              geometry={roundedBox(w * 0.62, 1.05, 0.03, 0.02)}
              material={flat('#dff3ff')}
              position={[-w * 0.12, 1.1, d / 2]}
            />
            {[0, 1, 2, 3].flatMap((row) =>
              [0, 1, 2].map((col) => (
                <mesh
                  key={`${row}-${col}`}
                  geometry={canGeometry}
                  material={flat(CAN_COLORS[(row + col) % CAN_COLORS.length])}
                  position={[-w * 0.12 + (col - 1) * 0.2, 0.75 + row * 0.24, d / 2 + 0.03]}
                />
              ))
            )}
            <Box
              size={[0.2, 0.3, 0.05]}
              position={[w * 0.33, 1.2, d / 2]}
              color="#fff6ea"
              outline={false}
            />
            <Box
              size={[w * 0.6, 0.14, 0.05]}
              position={[-w * 0.12, 0.3, d / 2]}
              color="#5d6b8a"
              outline={false}
            />
            <Cyl
              top={0.04}
              height={0.02}
              position={[w * 0.33, 1.25, d / 2 + 0.03]}
              rotation={[Math.PI / 2, 0, 0]}
              color="#ffd48a"
              outline={false}
            />
          </group>
        )
      })}
    </group>
  )
}
