import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { toon } from '../toon/materials'
import { outlineFurniture } from '../toon/outline'
import { useSettings } from '../state/settings'

// Small building blocks for the toy furniture. Geometries are cached by size, so
// equal pieces (all the chair seats, all the table legs) share one geometry.

const boxCache = new Map<string, THREE.BufferGeometry>()
export function roundedBox(w: number, h: number, d: number, radius = 0.05) {
  const key = [w, h, d, radius].map((v) => v.toFixed(3)).join('/')
  let geometry = boxCache.get(key)
  if (!geometry) {
    const r = Math.min(radius, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)
    geometry = new RoundedBoxGeometry(w, h, d, 2, Math.max(r, 0.001))
    boxCache.set(key, geometry)
  }
  return geometry
}

const cylinderCache = new Map<string, THREE.BufferGeometry>()
export function cylinder(top: number, bottom: number, h: number, segments = 16) {
  const key = [top, bottom, h, segments].join('/')
  let geometry = cylinderCache.get(key)
  if (!geometry) {
    geometry = new THREE.CylinderGeometry(top, bottom, h, segments)
    cylinderCache.set(key, geometry)
  }
  return geometry
}

export const unitSphere = new THREE.SphereGeometry(1, 16, 12)

type Vec3 = [number, number, number]

type BoxProps = {
  size: Vec3
  position: Vec3
  color: string
  rotation?: Vec3
  radius?: number
  outline?: boolean
  material?: THREE.Material
}

// a rounded toy box, positioned by its centre
export function Box({
  size,
  position,
  color,
  rotation,
  radius = 0.05,
  outline = true,
  material,
}: BoxProps) {
  const outlines = useSettings((s) => s.outlines)
  const geometry = roundedBox(size[0], size[1], size[2], radius)
  return (
    <mesh
      geometry={geometry}
      material={material ?? toon(color)}
      position={position}
      rotation={rotation}
    >
      {outline && outlines && (
        <mesh geometry={geometry} material={outlineFurniture} raycast={() => null} />
      )}
    </mesh>
  )
}

type BlobProps = {
  position: Vec3
  scale: number | Vec3
  color: string
  outline?: boolean
}

export function Blob({ position, scale, color, outline = true }: BlobProps) {
  const outlines = useSettings((s) => s.outlines)
  return (
    <mesh geometry={unitSphere} material={toon(color)} position={position} scale={scale}>
      {outline && outlines && (
        <mesh geometry={unitSphere} material={outlineFurniture} raycast={() => null} />
      )}
    </mesh>
  )
}

type CylProps = {
  top: number
  bottom?: number
  height: number
  position: Vec3
  color: string
  rotation?: Vec3
  outline?: boolean
}

export function Cyl({
  top,
  bottom = top,
  height,
  position,
  color,
  rotation,
  outline = true,
}: CylProps) {
  const outlines = useSettings((s) => s.outlines)
  const geometry = cylinder(top, bottom, height)
  return (
    <mesh geometry={geometry} material={toon(color)} position={position} rotation={rotation}>
      {outline && outlines && (
        <mesh geometry={geometry} material={outlineFurniture} raycast={() => null} />
      )}
    </mesh>
  )
}

export type Instance = { position: Vec3; rotation?: number; scale?: Vec3; color?: string }

type InstancedProps = {
  geometry: THREE.BufferGeometry
  instances: Instance[]
  color?: string
  outline?: boolean
  onClick?: (index: number) => void
  onPointerOver?: (index: number) => void
  onPointerOut?: () => void
}

// many copies of one part (e.g. all chair seats) in a single draw call, with outline
export function Instanced({
  geometry,
  instances,
  color = '#ffffff',
  outline = true,
  ...events
}: InstancedProps) {
  const outlines = useSettings((s) => s.outlines)
  const mesh = useRef<THREE.InstancedMesh>(null)
  const hull = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const matrix = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const c = new THREE.Color()
    instances.forEach((inst, i) => {
      q.setFromAxisAngle(up, inst.rotation ?? 0)
      matrix.compose(
        new THREE.Vector3(...inst.position),
        q,
        new THREE.Vector3(...(inst.scale ?? [1, 1, 1]))
      )
      m.setMatrixAt(i, matrix)
      if (inst.color) m.setColorAt(i, c.set(inst.color))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
    if (hull.current) {
      hull.current.instanceMatrix = m.instanceMatrix
      hull.current.computeBoundingSphere()
    }
  }, [instances, outlines])

  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[geometry, toon(color), instances.length]}
        onClick={
          events.onClick && ((e) => (e.stopPropagation(), events.onClick!(e.instanceId ?? 0)))
        }
        onPointerOver={
          events.onPointerOver &&
          ((e) => (e.stopPropagation(), events.onPointerOver!(e.instanceId ?? 0)))
        }
        onPointerOut={events.onPointerOut}
      />
      {outline && outlines && (
        <instancedMesh
          ref={hull}
          args={[geometry, outlineFurniture, instances.length]}
          raycast={() => null}
        />
      )}
    </group>
  )
}
