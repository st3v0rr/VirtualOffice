import { memo } from 'react'
import { office, wallFaceZ, type Component } from '../map/office'
import { pastel } from '../toon/materials'
import { Blob, Box, Cyl } from './parts'
import { wallHeightAt } from './walls'
import { useSettings } from '../state/settings'

// Decoration of the Tiled map -> toy furniture.
//
// The extractor groups the decoration tiles of each layer into components (bounding
// box + average colour). Here each component becomes a prefab:
// 1. an explicit entry in PREFABS (keyed by "x,y" of the component in tiles), or
// 2. a guess: green things are plants, things on the wall are pictures, everything
//    else that blocks becomes a rounded box in its sampled (pastelised) colour.
// Adding a new room in Tiled therefore works without touching this file; to make
// something look nicer, add its position here.

export type Kind =
  | 'hidden'
  | 'block'
  | 'table'
  | 'desk'
  | 'poolTable'
  | 'bookshelf'
  | 'lowShelf'
  | 'shelf'
  | 'cabinet'
  | 'plant'
  | 'waterCooler'
  | 'printer'
  | 'boxes'
  | 'globe'
  | 'wallDecor'
  | 'tv'

const PREFABS: Record<string, Kind> = {
  // conference room
  '9.5,4': 'tv',
  '2,20': 'plant',
  '17,20': 'plant',
  // lounge: pool table, drinks cabinet, water dispenser and the plants at the wall
  '21,7': 'poolTable',
  '29,7': 'cabinet',
  '32,6': 'waterCooler',
  '32,4': 'hidden',
  '20,12': 'plant',
  '24,12': 'plant',
  '28,12': 'plant',
  '20,10': 'hidden',
  '24,10': 'hidden',
  '28,10': 'hidden',
  // boss office
  '43,3': 'desk',
  '44,4': 'hidden',
  '37,3': 'cabinet',
  '37,2': 'hidden',
  '46,3': 'plant',
  '46,1': 'hidden',
  '45,6': 'hidden',
  // pictures on the north wall of the open office
  '34,8': 'wallDecor',
  '36,8': 'wallDecor',
  '39,8': 'wallDecor',
  // open office: the desks are drawn by the computers
  '43,14': 'hidden',
  '46,14': 'hidden',
  '44,15': 'hidden',
  '43,22': 'hidden',
  '44,23': 'hidden',
  '39,10': 'waterCooler',
  '46,10': 'shelf',
  '52,10': 'plant',
  '52,9': 'hidden',
  '39,27': 'printer',
  '39,26': 'hidden',
  '50,27': 'boxes',
  // meeting room
  '23,20': 'table',
  '23,19': 'hidden',
  '20,17': 'shelf',
  '20,15': 'hidden',
  // library
  '3,26': 'bookshelf',
  '3,32': 'lowShelf',
  '6,32': 'lowShelf',
  '9,32': 'lowShelf',
  '12,32': 'lowShelf',
  '16,28': 'globe',
  '18,28': 'desk',
  '22,28': 'desk',
  '26,28': 'desk',
  '18,32': 'desk',
  '22,32': 'desk',
  '26,32': 'desk',
  '2,34': 'plant',
  '16,34': 'plant',
}

function isGreen(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return g > r + 8 && g > b
}

export function classify(c: Component): Kind {
  // positions are rounded to quarter tiles, some objects sit a few pixels off the grid
  const q = (v: number) => Math.round(v * 4) / 4
  const explicit = PREFABS[`${q(c.x)},${q(c.y)}`]
  if (explicit) return explicit
  // the Wall layer draws the front faces of walls, the 3D walls do that already
  if (c.layer === 'Wall') return 'hidden'
  if (isGreen(c.color)) return 'plant'
  if (c.onWall) return 'wallDecor'
  if (!c.collides) return 'hidden'
  return 'block'
}

const WOOD = '#f1cfa3'
const WOOD_DARK = '#d9a877'
const BOOK_COLORS = ['#ff9aa2', '#ffd48a', '#b5e8a3', '#8fd3e8', '#c9a7f5', '#f7b7d2', '#9fb2ff']

type PrefabProps = { c: Component }

function Table({
  c,
  color = WOOD,
  height = 0.62,
}: PrefabProps & { color?: string; height?: number }) {
  const w = c.w - 0.12
  const d = c.h - 0.12
  const legX = w / 2 - 0.12
  const legZ = d / 2 - 0.12
  return (
    <group>
      <Box size={[w, 0.1, d]} position={[0, height, 0]} color={color} radius={0.04} />
      {[
        [legX, legZ],
        [-legX, legZ],
        [legX, -legZ],
        [-legX, -legZ],
      ].map(([x, z], i) => (
        <Box
          key={i}
          size={[0.1, height - 0.05, 0.1]}
          position={[x, (height - 0.05) / 2, z]}
          color={WOOD_DARK}
          outline={false}
        />
      ))}
    </group>
  )
}

function Books({
  width,
  y,
  z,
  seed,
  depth = 0.25,
}: {
  width: number
  y: number
  z: number
  seed: number
  depth?: number
}) {
  const books = []
  let x = -width / 2 + 0.06
  let i = seed
  while (x < width / 2 - 0.12) {
    const w = 0.08 + ((i * 37) % 5) * 0.015
    const h = 0.2 + ((i * 53) % 4) * 0.03
    books.push(
      <Box
        key={i}
        size={[w, h, depth]}
        position={[x + w / 2, y + h / 2, z]}
        color={BOOK_COLORS[i % BOOK_COLORS.length]}
        radius={0.015}
        outline={false}
      />
    )
    x += w + 0.015
    i++
  }
  return <>{books}</>
}

function Bookshelf({ c }: PrefabProps) {
  // the Tiled shelf is 4 shelves of 3 tiles side by side
  const segments = Math.max(1, Math.round(c.w / 3))
  const segW = c.w / segments
  const height = 1.55
  const d = c.h - 0.2
  return (
    <group>
      {Array.from({ length: segments }, (_, s) => {
        const x = -c.w / 2 + segW * (s + 0.5)
        return (
          <group key={s} position={[x, 0, 0]}>
            <Box
              size={[segW - 0.1, height, d]}
              position={[0, height / 2, 0]}
              color={s % 2 ? '#e7b98c' : WOOD}
            />
            {[0.12, 0.6, 1.08].map((y, row) => (
              <Books key={row} width={segW - 0.3} y={y} z={d / 2 - 0.1} seed={s * 11 + row * 5} />
            ))}
          </group>
        )
      })}
    </group>
  )
}

function Plant({ c }: PrefabProps) {
  const big = c.w >= 2 || c.h >= 3
  const s = big ? 1.35 : 1
  return (
    <group position={[0, 0, (c.h - 1) / 2 - 0.1]} scale={s}>
      <Cyl top={0.2} bottom={0.14} height={0.3} position={[0, 0.15, 0]} color="#f3a98f" />
      <Blob position={[0, 0.5, 0]} scale={[0.26, 0.26, 0.26]} color="#9fd8a0" />
      <Blob position={[0.13, 0.66, 0.04]} scale={0.18} color="#b4e6a8" />
      <Blob position={[-0.12, 0.7, -0.03]} scale={0.17} color="#8fcf97" />
      <Blob position={[0, 0.83, 0]} scale={0.13} color="#b4e6a8" />
    </group>
  )
}

function PoolTable({ c }: PrefabProps) {
  const w = c.w - 0.2
  const d = c.h - 0.4
  return (
    <group>
      <Box size={[w - 0.3, 0.45, d - 0.3]} position={[0, 0.25, 0]} color={WOOD_DARK} />
      <Box size={[w, 0.14, d]} position={[0, 0.55, 0]} color={WOOD} radius={0.06} />
      <Box
        size={[w - 0.25, 0.04, d - 0.25]}
        position={[0, 0.63, 0]}
        color="#8fd9a8"
        radius={0.015}
        outline={false}
      />
      {[
        ['#ff9aa2', 0.4, 0.1],
        ['#ffe08a', 0.55, -0.15],
        ['#9fb2ff', 0.7, 0.05],
        ['#ffffff', -0.6, 0],
      ].map(([color, x, z], i) => (
        <Blob
          key={i}
          position={[x as number, 0.69, z as number]}
          scale={0.06}
          color={color as string}
          outline={false}
        />
      ))}
    </group>
  )
}

function Cabinet({ c, height }: PrefabProps & { height: number }) {
  const w = c.w - 0.12
  const d = Math.min(c.h - 0.12, 0.8)
  return (
    <group position={[0, 0, (c.h - 0.12 - d) / 2]}>
      <Box size={[w, height, d]} position={[0, height / 2, 0]} color={WOOD} />
      <Box
        size={[0.02, height - 0.2, 0.02]}
        position={[0, height / 2, d / 2 + 0.01]}
        color={WOOD_DARK}
        outline={false}
      />
      {[-0.08, 0.08].map((x) => (
        <Blob
          key={x}
          position={[x, height * 0.55, d / 2 + 0.02]}
          scale={0.03}
          color="#fff3d6"
          outline={false}
        />
      ))}
    </group>
  )
}

function WaterCooler() {
  return (
    <group>
      <Box size={[0.5, 0.8, 0.5]} position={[0, 0.4, 0]} color="#f5f0e6" />
      <Cyl top={0.2} bottom={0.2} height={0.4} position={[0, 1.02, 0]} color="#a8dcf0" />
      <Box size={[0.12, 0.08, 0.06]} position={[0, 0.6, 0.27]} color="#8fd3e8" outline={false} />
    </group>
  )
}

function Printer() {
  return (
    <group>
      <Table
        c={{ x: 0, y: 0, w: 1.6, h: 1.2, color: '', collides: true, onWall: false, layer: '' }}
        color="#e6e1ee"
        height={0.45}
      />
      <Box size={[0.8, 0.35, 0.6]} position={[0, 0.68, 0]} color="#f5f0e6" />
      <Box size={[0.5, 0.03, 0.4]} position={[0, 0.87, 0.05]} color="#ffffff" outline={false} />
    </group>
  )
}

function Boxes() {
  return (
    <group>
      <Box size={[0.6, 0.5, 0.6]} position={[-0.6, 0.25, 0.2]} color="#f0c99a" />
      <Box size={[0.5, 0.45, 0.5]} position={[0.1, 0.23, 0.1]} color="#e8bb8a" />
      <Box
        size={[0.45, 0.4, 0.45]}
        position={[-0.45, 0.7, 0.15]}
        rotation={[0, 0.3, 0]}
        color="#f5d6ae"
      />
      <Box
        size={[0.5, 0.45, 0.5]}
        position={[0.8, 0.23, -0.1]}
        rotation={[0, -0.2, 0]}
        color="#f0c99a"
      />
    </group>
  )
}

function Globe() {
  return (
    <group>
      <Cyl top={0.12} bottom={0.18} height={0.08} position={[0, 0.04, 0]} color={WOOD_DARK} />
      <Cyl top={0.03} height={0.5} position={[0, 0.3, 0]} color={WOOD_DARK} outline={false} />
      <Blob position={[0, 0.72, 0]} scale={0.22} color="#8fd3e8" />
      <Blob
        position={[0.08, 0.78, 0.13]}
        scale={[0.1, 0.08, 0.06]}
        color="#b5e8a3"
        outline={false}
      />
    </group>
  )
}

function WallDecor({ c, tv }: PrefabProps & { tv?: boolean }) {
  const lowWalls = useSettings((s) => s.lowWalls)
  const faceZ = wallFaceZ(c)
  const cx = c.x + c.w / 2
  const wall = wallHeightAt(Math.floor(cx), faceZ - 1, lowWalls)
  // cut-away walls are too low for pictures
  if (wall < 1) return null
  const w = Math.min(c.w, 2.4) - 0.2
  const h = tv ? w * 0.56 : Math.min(c.h * 0.4, 0.7)
  const y = Math.min(wall - h / 2 - 0.15, 1.05)
  return (
    <group position={[cx, y, faceZ + 0.04]}>
      <Box
        size={[w, h, 0.06]}
        position={[0, 0, 0]}
        color={tv ? '#5d6b8a' : '#fff6ea'}
        radius={0.02}
      />
      <Box
        size={[w - 0.12, h - 0.12, 0.02]}
        position={[0, 0, 0.035]}
        color={tv ? '#9fc7f0' : pastel(c.color, 0.35)}
        radius={0.005}
        outline={false}
      />
    </group>
  )
}

// The blocking tiles inside a component, merged into rectangles (relative to the
// component centre). Pieces like the L-shaped desk in the boss office aren't boxes.
function blockerRects(c: Component) {
  const inside = (x: number, y: number) =>
    office.blockers.some(
      (b) => b.x <= x + 0.01 && b.y <= y + 0.01 && b.x + b.w >= x + 0.99 && b.y + b.h >= y + 0.99
    )
  const x0 = Math.floor(c.x)
  const y0 = Math.floor(c.y)
  const w = Math.ceil(c.x + c.w) - x0
  const h = Math.ceil(c.y + c.h) - y0
  const free = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => inside(x0 + x, y0 + y))
  )
  const rects: { x: number; y: number; w: number; h: number }[] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!free[y][x]) continue
      let rw = 1
      while (x + rw < w && free[y][x + rw]) rw++
      let rh = 1
      while (y + rh < h && free[y + rh].slice(x, x + rw).every(Boolean)) rh++
      for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) free[yy][xx] = false
      rects.push({
        x: x0 + x + rw / 2 - (c.x + c.w / 2),
        y: y0 + y + rh / 2 - (c.y + c.h / 2),
        w: rw,
        h: rh,
      })
    }
  // not a blocking component: use the whole bounding box
  return rects.length ? rects : [{ x: 0, y: 0, w: c.w, h: c.h }]
}

const Prefab = memo(function Prefab({ c, kind }: { c: Component; kind: Kind }) {
  switch (kind) {
    case 'hidden':
      return null
    case 'wallDecor':
      return <WallDecor c={c} />
    case 'tv':
      return <WallDecor c={c} tv />
  }
  const inner = (() => {
    switch (kind) {
      case 'table':
        return <Table c={c} />
      case 'desk':
        return (
          <group>
            {blockerRects(c).map((r, i) => (
              <group key={i} position={[r.x, 0, r.y]}>
                <Table c={{ ...c, w: r.w, h: r.h }} color="#f5dcb8" />
              </group>
            ))}
            <Box
              size={[0.5, 0.03, 0.35]}
              position={[0.1, 0.69, 0]}
              color="#ffffff"
              radius={0.01}
              outline={false}
            />
            <Box
              size={[0.02, 0.035, 0.36]}
              position={[0.1, 0.7, 0]}
              color="#c9a7f5"
              radius={0.005}
              outline={false}
            />
          </group>
        )
      case 'poolTable':
        return <PoolTable c={c} />
      case 'bookshelf':
        return <Bookshelf c={c} />
      case 'lowShelf':
        return (
          <group>
            <Box size={[c.w - 0.15, 0.7, c.h - 0.5]} position={[0, 0.35, -0.1]} color={WOOD} />
            <Books width={c.w - 0.3} y={0.7} z={-0.1} seed={Math.round(c.x)} depth={0.4} />
          </group>
        )
      case 'shelf':
        return (
          <group position={[0, 0, (c.h - 0.6) / 2 - 0.1]}>
            <Box size={[c.w - 0.12, 1.25, 0.55]} position={[0, 0.625, 0]} color="#e6e1ee" />
            <Books width={c.w - 0.4} y={0.2} z={0.08} seed={Math.round(c.x + c.y)} />
            <Books width={c.w - 0.4} y={0.72} z={0.08} seed={Math.round(c.x * 3)} />
          </group>
        )
      case 'cabinet':
        return <Cabinet c={c} height={c.h >= 2 ? 1.25 : 0.6} />
      case 'plant':
        return <Plant c={c} />
      case 'waterCooler':
        return <WaterCooler />
      case 'printer':
        return <Printer />
      case 'boxes':
        return <Boxes />
      case 'globe':
        return <Globe />
      default: {
        const height = c.w * c.h <= 1 ? 0.55 : 0.7
        return (
          <group>
            {blockerRects(c).map((r, i) => (
              <Box
                key={i}
                size={[r.w - 0.1, height, r.h - 0.1]}
                position={[r.x, height / 2, r.y]}
                color={pastel(c.color)}
              />
            ))}
          </group>
        )
      }
    }
  })()
  return <group position={[c.x + c.w / 2, 0, c.y + c.h / 2]}>{inner}</group>
})

export default function Furniture() {
  return (
    <group>
      {office.components.map((c, i) => (
        <Prefab key={i} c={c} kind={classify(c)} />
      ))}
    </group>
  )
}
