import { memo, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { findAsset, type AssetInfo } from '../../../types/map/catalog'
import type { MapZone, Placement, VirtualOfficeMap } from '../../../types/map/format'
import { createCollision, SUB } from '../map/collision'
import type { OfficeData } from '../map/compile'
import { CATEGORY_COLORS, ZONE_INFO } from './labels'
import * as ops from './ops'
import { useEditor, type Selection } from './store'

// The map seen from above, in tile units (the viewBox), as the editor's main view.

type Point = { x: number; y: number }
type Target = NonNullable<Selection>
type Drag =
  | { kind: 'move'; target: Target; start: Point; origin: Point }
  | {
      kind: 'resize'
      target: { kind: 'placement' | 'zone'; id: string }
      start: Point
      origin: { w: number; h: number }
    }
  | { kind: 'paint'; last: Point }
  | { kind: 'rect'; start: Point; end: Point }

const TOOL_CURSORS = {
  select: 'default',
  place: 'copy',
  brush: 'crosshair',
  fill: 'crosshair',
  room: 'crosshair',
  zone: 'crosshair',
  label: 'text',
  spawn: 'cell',
} as const

// horizontal runs of cells that pass `test` as one SVG path
function runsPath(
  width: number,
  height: number,
  test: (x: number, y: number) => boolean,
  size = 1
) {
  let d = ''
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!test(x, y)) continue
      let run = 1
      while (x + run < width && test(x + run, y)) run++
      d += `M${x * size} ${y * size}h${run * size}v${size}h${-run * size}z`
      x += run - 1
    }
  return d
}

// the cells along a line, so a quick brush stroke leaves no gaps
function lineCells(a: Point, b: Point): ops.Cell[] {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.25))
  const cells = new Map<string, ops.Cell>()
  for (let i = 0; i <= steps; i++) {
    const x = Math.floor(a.x + ((b.x - a.x) * i) / steps)
    const y = Math.floor(a.y + ((b.y - a.y) * i) / steps)
    cells.set(`${x},${y}`, { x, y })
  }
  return [...cells.values()]
}

function positionOf(map: VirtualOfficeMap, target: Target): Point {
  if (target.kind === 'spawn') return map.spawn
  const list =
    target.kind === 'placement' ? map.placements : target.kind === 'zone' ? map.zones : map.labels
  const item = list.find((i) => i.id === target.id)
  return item ? { x: item.x, y: item.y } : { x: 0, y: 0 }
}

function moveTo(map: VirtualOfficeMap, target: Target, x: number, y: number) {
  switch (target.kind) {
    case 'placement':
      return ops.movePlacement(map, target.id, x, y)
    case 'zone':
      return ops.updateZone(map, target.id, { x, y })
    case 'label':
      return ops.updateLabel(map, target.id, { x, y })
    case 'spawn':
      return ops.setSpawn(map, x, y)
  }
}

// the footprint of a new placement under the pointer, like placeAsset() puts it
function ghostRect(map: VirtualOfficeMap, info: AssetInfo, p: Point, step: number) {
  return ops.clampRect(map, {
    x: ops.snap(p.x - info.w / 2, step),
    y: ops.snap(p.y - info.h / 2, step),
    w: info.w,
    h: info.h,
  })
}

const PlacementShape = memo(function PlacementShape({
  p,
  info,
  selected,
}: {
  p: Placement
  info?: AssetInfo
  selected: boolean
}) {
  const onWall = info?.mount === 'wall'
  const collides = p.collides ?? info?.collides ?? false
  const fill = p.color ?? info?.color ?? (info ? CATEGORY_COLORS[info.category] : '#ffb3b3')
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  const rotation = p.rotation ?? 0
  // a small arrow on the side the front faces
  const front =
    info?.rotatable &&
    {
      0: [cx, p.y + p.h, 0],
      90: [p.x + p.w, cy, -90],
      180: [cx, p.y, 180],
      270: [p.x, cy, 90],
    }[rotation]
  const icon = Math.min(p.w, p.h, 1.6) * 0.62
  return (
    <g
      data-kind="placement"
      data-id={p.id}
      data-asset={p.asset}
      data-rotation={rotation}
      className={`placement${selected ? ' selected' : ''}${onWall ? ' wall-mounted' : ''}`}
    >
      <rect
        x={p.x + 0.04}
        y={p.y + 0.04}
        width={Math.max(p.w - 0.08, 0.05)}
        height={Math.max(p.h - 0.08, 0.05)}
        rx={0.12}
        fill={p.asset === 'blocker' ? 'url(#hatch)' : fill}
        fillOpacity={onWall ? 0.75 : 0.95}
        className={collides ? 'solid' : 'passable'}
      />
      {p.solid?.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === '.' ? (
            <rect
              key={`${x},${y}`}
              x={p.x + x + 0.1}
              y={p.y + y + 0.1}
              width={0.8}
              height={0.8}
              className="free-cell"
            />
          ) : null
        )
      )}
      {front && (
        <path
          d="M -0.18 -0.05 L 0.18 -0.05 L 0 0.17 Z"
          transform={`translate(${front[0]} ${front[1]}) rotate(${front[2]})`}
          className="front"
        />
      )}
      <text x={cx} y={cy} fontSize={icon} className="icon">
        {info?.icon ?? '❓'}
      </text>
    </g>
  )
})

export default function Grid2D({ office }: { office: OfficeData | null }) {
  const map = useEditor((s) => s.map)!
  const zoom = useEditor((s) => s.zoom)
  const tool = useEditor((s) => s.tool)
  const selection = useEditor((s) => s.selection)
  const overlay = useEditor((s) => s.overlay)
  const asset = useEditor((s) => s.asset)
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [hover, setHover] = useState<Point | null>(null)
  const [drawing, setDrawing] = useState<ops.Rect | null>(null)

  const toTiles = (e: { clientX: number; clientY: number }): Point => {
    const r = svg.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * map.width,
      y: ((e.clientY - r.top) / r.height) * map.height,
    }
  }

  // ---------- the drawing, memoized per part so dragging one thing stays cheap ----------

  const tiles = useMemo(
    () =>
      Object.entries(map.tileTypes)
        .filter(([, type]) => type.kind !== 'void')
        .map(([key, type]) => {
          const d = runsPath(map.width, map.height, (x, y) => map.tiles[y][x] === key)
          if (!d) return null
          return (
            <g key={key}>
              <path d={d} fill={type.color} />
              {type.kind === 'wall' && <path d={d} fill="url(#wall)" className="wall" />}
            </g>
          )
        }),
    [map.tileTypes, map.tiles, map.width, map.height]
  )

  const collisionLayer = useMemo(() => {
    if (!overlay || !office) return null
    const collision = createCollision(office)
    const reached = collision.reachableFrom(office.spawn.x, office.spawn.z)
    const w = collision.width
    const blocked = runsPath(
      w,
      collision.height,
      (x, y) => collision.blocked[y * w + x] === 1,
      1 / SUB
    )
    // free, but no way leads there from the spawn
    const lonely = runsPath(
      w,
      collision.height,
      (x, y) => collision.clear[y * w + x] === 1 && !reached[y * w + x],
      1 / SUB
    )
    return (
      <g className="collision-overlay">
        <path d={blocked} className="blocked" />
        <path d={lonely} className="unreachable" />
      </g>
    )
  }, [overlay, office])

  const selectedId = selection && selection.kind !== 'spawn' ? selection.id : null
  // the zone areas lie under the furniture, their tags on top so they can always be clicked
  const zones = useMemo(() => {
    const nested = (z: MapZone) =>
      map.zones.some(
        (o) =>
          o !== z && o.x <= z.x && o.y <= z.y && o.x + o.w >= z.x + z.w && o.y + o.h >= z.y + z.h
      )
    const areas = map.zones.map((z) => (
      <rect
        key={z.id}
        className="zone"
        x={z.x}
        y={z.y}
        width={z.w}
        height={z.h}
        fill={ZONE_INFO[z.type].color}
        stroke={ZONE_INFO[z.type].color}
      />
    ))
    const tags = map.zones.map((z) => {
      const info = ZONE_INFO[z.type]
      // a zone inside another one (a stage in a hall) has its tag at the bottom
      const top = nested(z) ? z.y + z.h - 1.05 : z.y + 0.15
      return (
        <g key={z.id} data-kind="zone" data-id={z.id} className="zone-tag">
          <rect
            x={z.x + 0.15}
            y={top}
            width={Math.max(0.6, Math.min(z.w - 0.3, 0.42 * (z.name.length + 3)))}
            height={0.9}
            rx={0.25}
            fill={info.color}
          />
          <text x={z.x + 0.35} y={top + 0.47} fontSize={0.55}>
            🎧 {z.name}
          </text>
        </g>
      )
    })
    return { areas, tags }
  }, [map.zones])

  const placements = useMemo(() => {
    // wall-mounted things first, chairs on top
    const order = (p: Placement) =>
      findAsset(map, p.asset)?.mount === 'wall' ? 0 : p.asset === 'chair' ? 2 : 1
    return [...map.placements]
      .sort((a, b) => order(a) - order(b))
      .map((p) => (
        <PlacementShape
          key={p.id}
          p={p}
          info={findAsset(map, p.asset)}
          selected={selectedId === p.id}
        />
      ))
  }, [map, selectedId])

  const labels = map.labels.map((l) => (
    <g
      key={l.id}
      data-kind="label"
      data-id={l.id}
      className={`label${selectedId === l.id ? ' selected' : ''}`}
    >
      <rect
        x={l.x - 0.2 * l.text.length - 0.3}
        y={l.y - 0.45}
        width={0.4 * l.text.length + 0.6}
        height={0.9}
        rx={0.3}
      />
      <text x={l.x} y={l.y} fontSize={0.55}>
        {l.text}
      </text>
    </g>
  ))

  // ---------- selection outline and resize handle ----------

  let outline = null
  if (selection?.kind === 'placement' || selection?.kind === 'zone') {
    const item =
      selection.kind === 'placement'
        ? ops.findPlacement(map, selection.id)
        : map.zones.find((z) => z.id === selection.id)
    const resizable =
      selection.kind === 'zone' || (item && findAsset(map, (item as Placement).asset)?.resizable)
    if (item)
      outline = (
        <g className="selection">
          <rect x={item.x - 0.06} y={item.y - 0.06} width={item.w + 0.12} height={item.h + 0.12} />
          {resizable && (
            <rect
              data-kind="handle"
              className="handle"
              x={item.x + item.w - 0.3}
              y={item.y + item.h - 0.3}
              width={0.6}
              height={0.6}
            />
          )}
        </g>
      )
  }

  const info = tool === 'place' ? findAsset(map, asset) : undefined
  const ghost = info && hover && ghostRect(map, info, hover, 1)

  // ---------- pointer ----------

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const s = useEditor.getState()
    const current = s.map
    if (!current) return
    const p = toTiles(e)
    const step = e.altKey ? 0.25 : 1
    const hit = (e.target as Element).closest<SVGElement>('[data-kind]')
    const kind = hit?.dataset.kind
    const id = hit?.dataset.id ?? ''
    svg.current!.setPointerCapture(e.pointerId)
    s.set({ message: null })

    switch (s.tool) {
      case 'select': {
        const selected = s.selection
        if (kind === 'handle' && (selected?.kind === 'placement' || selected?.kind === 'zone')) {
          const target = { kind: selected.kind, id: selected.id }
          const item =
            target.kind === 'placement'
              ? ops.findPlacement(current, target.id)
              : current.zones.find((z) => z.id === target.id)
          if (!item) return
          s.begin()
          drag.current = { kind: 'resize', target, start: p, origin: { w: item.w, h: item.h } }
          return
        }
        const target: Selection =
          kind === 'placement' || kind === 'zone' || kind === 'label'
            ? { kind, id }
            : kind === 'spawn'
              ? { kind: 'spawn' }
              : null
        s.set({ selection: target })
        if (!target) return
        s.begin()
        drag.current = { kind: 'move', target, start: p, origin: positionOf(current, target) }
        return
      }
      case 'place': {
        const placed = ops.placeAsset(current, s.asset, p.x, p.y, step)
        s.apply(() => placed.map, { kind: 'placement', id: placed.id })
        return
      }
      case 'brush':
        s.begin()
        s.apply((m) => ops.setTiles(m, lineCells(p, p), s.tile))
        drag.current = { kind: 'paint', last: p }
        return
      case 'fill':
      case 'room':
      case 'zone':
        drag.current = { kind: 'rect', start: p, end: p }
        setDrawing(ops.cellRect(p, p))
        return
      case 'label': {
        const added = ops.addLabel(current, ops.snap(p.x, 0.5), ops.snap(p.y, 0.5))
        s.apply(() => added.map, { kind: 'label', id: added.id })
        s.set({ tool: 'select' })
        return
      }
      case 'spawn': {
        if (ops.tileKindAt(current, p.x, p.y) !== 'floor')
          return s.set({
            message: { text: 'Der Startpunkt muss auf einem Boden liegen.', error: true },
          })
        const x = step === 1 ? Math.floor(p.x) + 0.5 : ops.snap(p.x, step)
        const y = step === 1 ? Math.floor(p.y) + 0.5 : ops.snap(p.y, step)
        s.apply((m) => ops.setSpawn(m, x, y), { kind: 'spawn' })
        return
      }
    }
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = toTiles(e)
    if (tool === 'place') setHover(p)
    const d = drag.current
    if (!d) return
    const s = useEditor.getState()
    const step = e.altKey ? 0.25 : 1
    if (d.kind === 'move') {
      const x = d.origin.x + ops.snap(p.x - d.start.x, step)
      const y = d.origin.y + ops.snap(p.y - d.start.y, step)
      s.apply((m) => moveTo(m, d.target, x, y))
    } else if (d.kind === 'resize') {
      const w = Math.max(step, ops.snap(d.origin.w + p.x - d.start.x, step))
      const h = Math.max(step, ops.snap(d.origin.h + p.y - d.start.y, step))
      const { target } = d
      s.apply((m) =>
        target.kind === 'placement'
          ? ops.resizePlacement(m, target.id, w, h)
          : ops.updateZone(m, target.id, { w, h })
      )
    } else if (d.kind === 'paint') {
      const cells = lineCells(d.last, p)
      d.last = p
      s.apply((m) => ops.setTiles(m, cells, s.tile))
    } else {
      d.end = p
      setDrawing(ops.cellRect(d.start, p))
    }
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    const s = useEditor.getState()
    if (!d || !s.map) return
    if (d.kind !== 'rect') return s.end()
    setDrawing(null)
    const r = ops.clampRect(s.map, ops.cellRect(d.start, d.end))
    if (s.tool === 'fill') {
      s.apply((m) => ops.fillRect(m, r, s.tile))
    } else if (s.tool === 'room') {
      const kind = s.map.tileTypes[s.tile]?.kind
      const floor = kind === 'floor' ? s.tile : ops.firstTileOfKind(s.map, 'floor')
      const wall = kind === 'wall' ? s.tile : ops.firstTileOfKind(s.map, 'wall')
      if (!floor || !wall)
        return s.set({
          message: {
            text: 'Für einen Raum braucht die Karte einen Boden- und einen Wandbelag.',
            error: true,
          },
        })
      s.apply((m) => ops.drawRoom(m, r, floor, wall))
    } else if (s.tool === 'zone') {
      const added = ops.addZone(s.map, r)
      s.apply(() => added.map, { kind: 'zone', id: added.id })
      s.set({ tool: 'select' })
    }
  }

  const spawnSelected = selection?.kind === 'spawn'
  return (
    <svg
      ref={svg}
      className="grid2d"
      data-testid="editor-map"
      width={map.width * zoom}
      height={map.height * zoom}
      viewBox={`0 0 ${map.width} ${map.height}`}
      style={{ cursor: TOOL_CURSORS[tool] }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
    >
      <defs>
        <pattern id="grid" width={1} height={1} patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" className="grid-line" />
        </pattern>
        <pattern
          id="wall"
          width={0.5}
          height={0.5}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={0.18} height={0.5} className="wall-stripe" />
        </pattern>
        <pattern
          id="hatch"
          width={0.35}
          height={0.35}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width={0.35} height={0.35} className="hatch-bg" />
          <rect width={0.12} height={0.35} className="hatch-stripe" />
        </pattern>
      </defs>
      <rect width={map.width} height={map.height} className="void" />
      {tiles}
      <rect width={map.width} height={map.height} fill="url(#grid)" className="grid" />
      {collisionLayer}
      {zones.areas}
      {placements}
      {zones.tags}
      {labels}
      <g
        data-kind="spawn"
        className={`spawn${spawnSelected ? ' selected' : ''}`}
        transform={`translate(${map.spawn.x} ${map.spawn.y})`}
      >
        <circle r={0.42} />
        <text fontSize={0.5}>📍</text>
      </g>
      {outline}
      {ghost && (
        <rect
          className="ghost"
          x={ghost.x}
          y={ghost.y}
          width={ghost.w}
          height={ghost.h}
          rx={0.12}
        />
      )}
      {drawing && (
        <rect
          className={`drawing drawing-${tool}`}
          x={drawing.x}
          y={drawing.y}
          width={drawing.w}
          height={drawing.h}
        />
      )}
    </svg>
  )
}
