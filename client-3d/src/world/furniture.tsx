import { lazy, memo, Suspense, type ReactNode } from 'react'
import type { BuiltinAssetId } from '../../../types/map/catalog'
import { rotationToRadians } from '../../../types/map/format'
import { wallFaceZ, type FurnitureData, type TileRect } from '../map/office'
import { Blob, Box, Cyl } from './parts'
import { wallHeightAt } from './walls'
import { useSettings } from '../state/settings'
import { useOffice } from './officeContext'

// The placements of the map as toy furniture: every built-in asset of the catalog
// (types/map/catalog.ts) is a prefab made of rounded boxes, blobs and cylinders. Chairs,
// computers and vending machines are drawn by items.tsx, glTF models of the map by
// ModelPlacement.tsx.

const WOOD = '#f1cfa3'
const WOOD_DARK = '#d9a877'
const BOOK_COLORS = ['#ff9aa2', '#ffd48a', '#b5e8a3', '#8fd3e8', '#c9a7f5', '#f7b7d2', '#9fb2ff']

// the size of a prefab in its own orientation (front towards +z), and its place on the
// map for the pseudo-random details
type PrefabProps = { w: number; h: number; x: number; y: number }

function Table({
  w: width,
  h: depth,
  color = WOOD,
  height = 0.62,
}: PrefabProps & { color?: string; height?: number }) {
  const w = width - 0.12
  const d = depth - 0.12
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

function Bookshelf(c: PrefabProps) {
  // segments of about 3 tiles side by side
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

function LowShelf(c: PrefabProps) {
  return (
    <group>
      <Box size={[c.w - 0.15, 0.7, c.h - 0.5]} position={[0, 0.35, -0.1]} color={WOOD} />
      <Books width={c.w - 0.3} y={0.7} z={-0.1} seed={Math.round(c.x)} depth={0.4} />
    </group>
  )
}

function Shelf(c: PrefabProps) {
  return (
    <group position={[0, 0, (c.h - 0.6) / 2 - 0.1]}>
      <Box size={[c.w - 0.12, 1.25, 0.55]} position={[0, 0.625, 0]} color="#e6e1ee" />
      <Books width={c.w - 0.4} y={0.2} z={0.08} seed={Math.round(c.x + c.y)} />
      <Books width={c.w - 0.4} y={0.72} z={0.08} seed={Math.round(c.x * 3)} />
    </group>
  )
}

function Plant(c: PrefabProps) {
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

function PoolTable(c: PrefabProps) {
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

function Cabinet(c: PrefabProps) {
  const height = c.h >= 2 ? 1.25 : 0.6
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

function Printer(c: PrefabProps) {
  return (
    <group>
      <Table {...c} w={1.6} h={1.2} color="#e6e1ee" height={0.45} />
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

// the paper and the book on a desk; the desk itself is drawn from its blocking parts
function DeskTop() {
  return (
    <group>
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
}

// pictures and screens hang on the south face of the wall below their footprint
function WallDecor({ item, tv }: { item: FurnitureData; tv?: boolean }) {
  const office = useOffice()
  const lowWalls = useSettings((s) => s.lowWalls)
  const faceZ = wallFaceZ(office, item)
  const cx = item.x + item.w / 2
  const wall = wallHeightAt(office, Math.floor(cx), faceZ - 1, lowWalls)
  // cut-away walls are too low for pictures
  if (wall < 1) return null
  const w = Math.min(item.w, 2.4) - 0.2
  const h = tv ? w * 0.56 : Math.min(item.h * 0.4, 0.7)
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
        color={tv ? '#9fc7f0' : (item.color ?? item.asset.color ?? '#ffd6e0')}
        radius={0.005}
        outline={false}
      />
    </group>
  )
}

type FloorAsset = Exclude<
  BuiltinAssetId,
  'chair' | 'computer' | 'vendingMachine' | 'picture' | 'tv' | 'desk' | 'block' | 'blocker'
>

// the prefab of every built-in floor asset; the type makes sure none is missing
const PREFABS: Record<FloorAsset, (props: PrefabProps) => ReactNode> = {
  table: (c) => <Table {...c} />,
  poolTable: PoolTable,
  bookshelf: Bookshelf,
  lowShelf: LowShelf,
  shelf: Shelf,
  cabinet: Cabinet,
  boxes: Boxes,
  printer: Printer,
  waterCooler: WaterCooler,
  plant: Plant,
  globe: Globe,
}

// the blocking parts of a desk or block, relative to the centre of the footprint
function pieces(item: FurnitureData): TileRect[] {
  const cx = item.x + item.w / 2
  const cz = item.y + item.h / 2
  return (item.solid ?? [item]).map((r) => ({
    x: r.x + r.w / 2 - cx,
    y: r.y + r.h / 2 - cz,
    w: r.w,
    h: r.h,
  }))
}

export const Prefab = memo(function Prefab({ item }: { item: FurnitureData }) {
  const id = item.asset.id
  if (item.asset.model) return null
  if (id === 'picture') return <WallDecor item={item} />
  if (id === 'tv') return <WallDecor item={item} tv />
  // invisible, it only blocks
  if (id === 'blocker') return null

  const turned = item.rotation === 90 || item.rotation === 270
  const local: PrefabProps = {
    w: turned ? item.h : item.w,
    h: turned ? item.w : item.h,
    x: item.x,
    y: item.y,
  }
  let parts = null
  let inner = null
  if (id === 'desk') {
    // L-shaped desks (a collision mask) are drawn from their blocking parts
    parts = pieces(item).map((r, i) => (
      <group key={i} position={[r.x, 0, r.y]}>
        <Table w={r.w} h={r.h} x={item.x} y={item.y} color="#f5dcb8" />
      </group>
    ))
    inner = <DeskTop />
  } else if (id === 'block') {
    const height = item.w * item.h <= 1 ? 0.55 : 0.7
    parts = pieces(item).map((r, i) => (
      <Box
        key={i}
        size={[r.w - 0.1, height, r.h - 0.1]}
        position={[r.x, height / 2, r.y]}
        color={item.color ?? item.asset.color ?? '#d9d2ef'}
      />
    ))
  } else {
    const Render = PREFABS[id as FloorAsset]
    if (!Render) return null
    inner = <Render {...local} />
  }
  return (
    <group position={[item.x + item.w / 2, 0, item.y + item.h / 2]}>
      {parts}
      {inner && <group rotation={[0, rotationToRadians(item.rotation), 0]}>{inner}</group>}
    </group>
  )
})

export default function Furniture() {
  const office = useOffice()
  return (
    <group>
      {office.furniture.map((item) => (
        <Prefab key={item.id} item={item} />
      ))}
    </group>
  )
}

const ModelPlacement = lazy(() => import('./ModelPlacement'))

// glTF models registered by the map; they load after the scenery is baked, so they are
// drawn on their own (see Scene)
export function Models() {
  const office = useOffice()
  const models = office.furniture.filter((item) => item.asset.model)
  if (!models.length) return null
  return (
    <Suspense fallback={null}>
      {models.map((item) => (
        <ModelPlacement key={item.id} item={item} />
      ))}
    </Suspense>
  )
}
