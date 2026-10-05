import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { office, tileAt } from '../map/office'
import { pastel, toon } from '../toon/materials'
import { useSettings } from '../state/settings'
import { Box } from './parts'

// Floor (one instanced mesh) and walls of the office.

export const WALL_HIGH = 1.6
export const WALL_LOW = 0.42
const FLOOR_DEPTH = 0.45

// The camera looks from the south-east, so a wall hides the floor north-west of it.
// Those walls are cut down like in a doll's house; the outer back walls stay high.
export function wallHeightAt(tx: number, ty: number, lowWalls = true) {
  if (tileAt(tx, ty) !== '#') return 0
  if (!lowWalls) return WALL_HIGH
  const hides = [
    [-1, 0],
    [0, -1],
    [-1, -1],
  ].some(([dx, dy]) => tileAt(tx + dx, ty + dy) === 'f')
  return hides ? WALL_LOW : WALL_HIGH
}

function tileColor(tx: number, ty: number) {
  const index = office.floorColors[ty][tx]
  return index >= 0 ? office.palette[index] : '#dddddd'
}

const floorGeometry = new THREE.BoxGeometry(1, FLOOR_DEPTH, 1)

export function Floor({ onPointerDown }: { onPointerDown?: (x: number, z: number) => void }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const tiles = useMemo(() => {
    const list: { x: number; z: number; color: THREE.Color }[] = []
    for (let ty = 0; ty < office.height; ty++)
      for (let tx = 0; tx < office.width; tx++) {
        if (tileAt(tx, ty) !== 'f') continue
        const color = new THREE.Color(pastel(tileColor(tx, ty), 0.5))
        // a gentle checker pattern, like the tiles of a toy floor
        if ((tx + ty) % 2) color.offsetHSL(0, 0, -0.025)
        list.push({ x: tx + 0.5, z: ty + 0.5, color })
      }
    return list
  }, [])

  useLayoutEffect(() => {
    const m = mesh.current!
    const matrix = new THREE.Matrix4()
    tiles.forEach((t, i) => {
      matrix.makeTranslation(t.x, -FLOOR_DEPTH / 2, t.z)
      m.setMatrixAt(i, matrix)
      m.setColorAt(i, t.color)
    })
    m.instanceMatrix.needsUpdate = true
    m.instanceColor!.needsUpdate = true
    m.computeBoundingSphere()
  }, [tiles])

  return (
    <instancedMesh
      ref={mesh}
      args={[floorGeometry, toon('#ffffff'), tiles.length]}
      onPointerDown={
        onPointerDown &&
        ((e) => {
          if (e.button !== 0) return
          onPointerDown(e.point.x, e.point.z)
        })
      }
    />
  )
}

// Walls are merged into as few boxes as possible (greedy meshing over tiles of equal
// height): fewer draw calls and triangles, and no seams in the outline between tiles.
function wallBoxes(lowWalls: boolean) {
  const heights = office.rows.map((row, ty) =>
    [...row].map((_, tx) => wallHeightAt(tx, ty, lowWalls))
  )
  const used = heights.map((row) => row.map(() => false))
  const boxes: { x: number; z: number; w: number; d: number; h: number; color: string }[] = []
  for (let ty = 0; ty < office.height; ty++)
    for (let tx = 0; tx < office.width; tx++) {
      const h = heights[ty][tx]
      if (!h || used[ty][tx]) continue
      let w = 1
      while (tx + w < office.width && heights[ty][tx + w] === h && !used[ty][tx + w]) w++
      let d = 1
      const rowFits = (y: number) => {
        for (let x = tx; x < tx + w; x++) if (heights[y]?.[x] !== h || used[y][x]) return false
        return true
      }
      while (ty + d < office.height && rowFits(ty + d)) d++
      const color = new THREE.Color(0, 0, 0)
      for (let y = ty; y < ty + d; y++)
        for (let x = tx; x < tx + w; x++) {
          used[y][x] = true
          color.add(new THREE.Color(pastel(tileColor(x, y), 0.6)))
        }
      color.multiplyScalar(1 / (w * d))
      // walls are a soft lilac-cream, tinted a little by the pixel art
      color.lerp(new THREE.Color('#f1e8f7'), 0.6)
      boxes.push({ x: tx + w / 2, z: ty + d / 2, w, d, h, color: `#${color.getHexString()}` })
    }
  return boxes
}

export function Walls() {
  const lowWalls = useSettings((s) => s.lowWalls)
  const boxes = useMemo(() => wallBoxes(lowWalls), [lowWalls])
  return (
    <group>
      {boxes.map((b, i) => (
        <group key={i}>
          <Box
            size={[b.w - 0.02, b.h, b.d - 0.02]}
            position={[b.x, b.h / 2, b.z]}
            color={b.color}
            radius={0.06}
          />
          {/* a lighter cap makes the walls read as thick toy walls from above */}
          <Box
            size={[b.w - 0.1, 0.03, b.d - 0.1]}
            position={[b.x, b.h + 0.005, b.z]}
            color="#fffaf5"
            radius={0.01}
            outline={false}
          />
        </group>
      ))}
    </group>
  )
}
