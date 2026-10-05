import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { tileAt, type OfficeData } from '../map/office'
import { toon } from '../toon/materials'
import { useSettings } from '../state/settings'
import { Box } from './parts'
import { useOffice } from './officeContext'

// Floor (one instanced mesh) and walls of the office, in the colours of the map's tile types.

export const WALL_HIGH = 1.6
export const WALL_LOW = 0.42
const FLOOR_DEPTH = 0.45

// The camera looks from the south-east, so a wall hides the floor north-west of it.
// Those walls are cut down like in a doll's house; the outer back walls stay high.
export function wallHeightAt(office: OfficeData, tx: number, ty: number, lowWalls = true) {
  if (tileAt(office, tx, ty) !== '#') return 0
  if (!lowWalls) return WALL_HIGH
  const hides = [
    [-1, 0],
    [0, -1],
    [-1, -1],
  ].some(([dx, dy]) => tileAt(office, tx + dx, ty + dy) === 'f')
  return hides ? WALL_LOW : WALL_HIGH
}

const floorGeometry = new THREE.BoxGeometry(1, FLOOR_DEPTH, 1)

export function Floor({ onPointerDown }: { onPointerDown?: (x: number, z: number) => void }) {
  const office = useOffice()
  const mesh = useRef<THREE.InstancedMesh>(null)
  const tiles = useMemo(() => {
    const list: { x: number; z: number; color: THREE.Color }[] = []
    for (let ty = 0; ty < office.height; ty++)
      for (let tx = 0; tx < office.width; tx++) {
        if (tileAt(office, tx, ty) !== 'f') continue
        const color = new THREE.Color(office.colors[ty][tx])
        // a gentle checker pattern, like the tiles of a toy floor
        if ((tx + ty) % 2) color.offsetHSL(0, 0, -0.025)
        list.push({ x: tx + 0.5, z: ty + 0.5, color })
      }
    return list
  }, [office])

  useLayoutEffect(() => {
    const m = mesh.current!
    const matrix = new THREE.Matrix4()
    tiles.forEach((t, i) => {
      matrix.makeTranslation(t.x, -FLOOR_DEPTH / 2, t.z)
      m.setMatrixAt(i, matrix)
      m.setColorAt(i, t.color)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [tiles])

  return (
    <instancedMesh
      // a new mesh when the number of tiles changes (editor), instanced meshes can't grow
      key={tiles.length}
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
// height and colour): fewer draw calls and triangles, and no seams in the outline.
function wallBoxes(office: OfficeData, lowWalls: boolean) {
  const heights = office.rows.map((row, ty) =>
    [...row].map((_, tx) => wallHeightAt(office, tx, ty, lowWalls))
  )
  const same = (ax: number, ay: number, bx: number, by: number) =>
    heights[by]?.[bx] === heights[ay][ax] && office.colors[by][bx] === office.colors[ay][ax]
  const used = heights.map((row) => row.map(() => false))
  const boxes: { x: number; z: number; w: number; d: number; h: number; color: string }[] = []
  for (let ty = 0; ty < office.height; ty++)
    for (let tx = 0; tx < office.width; tx++) {
      const h = heights[ty][tx]
      if (!h || used[ty][tx]) continue
      let w = 1
      while (tx + w < office.width && same(tx, ty, tx + w, ty) && !used[ty][tx + w]) w++
      let d = 1
      const rowFits = (y: number) => {
        for (let x = tx; x < tx + w; x++) if (!same(tx, ty, x, y) || used[y][x]) return false
        return true
      }
      while (ty + d < office.height && rowFits(ty + d)) d++
      for (let y = ty; y < ty + d; y++) for (let x = tx; x < tx + w; x++) used[y][x] = true
      boxes.push({ x: tx + w / 2, z: ty + d / 2, w, d, h, color: office.colors[ty][tx] })
    }
  return boxes
}

export function Walls() {
  const office = useOffice()
  const lowWalls = useSettings((s) => s.lowWalls)
  const boxes = useMemo(() => wallBoxes(office, lowWalls), [office, lowWalls])
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
