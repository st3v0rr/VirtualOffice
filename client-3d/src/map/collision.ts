import type { TileRect } from './compile'

// Collision against walls, void and the blocking furniture of the map, on a grid of quarter
// tiles (8 map pixels). The player is a small box at the feet, the size of the old 2D
// client's body (16 x 9.6 px).

export const SUB = 4
const CELL = 1 / SUB
export const HALF_W = 0.25
export const HALF_D = 0.15

// what collision needs from an office; small, so it can be sent to the path worker
export type CollisionSource = {
  width: number
  height: number
  rows: string[]
  blockers: TileRect[]
}

export type Path = { x: number; z: number }[]

class MinHeap {
  private items: number[] = []
  private prio: number[] = []
  get size() {
    return this.items.length
  }
  push(item: number, p: number) {
    const a = this.items
    const q = this.prio
    a.push(item)
    q.push(p)
    let i = a.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (q[parent] <= q[i]) break
      ;[a[i], a[parent]] = [a[parent], a[i]]
      ;[q[i], q[parent]] = [q[parent], q[i]]
      i = parent
    }
  }
  pop() {
    const a = this.items
    const q = this.prio
    const top = a[0]
    const lastItem = a.pop()!
    const lastPrio = q.pop()!
    if (a.length) {
      a[0] = lastItem
      q[0] = lastPrio
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < a.length && q[l] < q[m]) m = l
        if (r < a.length && q[r] < q[m]) m = r
        if (m === i) break
        ;[a[i], a[m]] = [a[m], a[i]]
        ;[q[i], q[m]] = [q[m], q[i]]
        i = m
      }
    }
    return top
  }
}

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const

export function createCollision(source: CollisionSource) {
  const gw = source.width * SUB
  const gh = source.height * SUB
  const blocked = new Uint8Array(gw * gh)

  for (let ty = 0; ty < source.height; ty++) {
    for (let tx = 0; tx < source.width; tx++) {
      if (source.rows[ty][tx] === 'f') continue
      for (let sy = 0; sy < SUB; sy++)
        for (let sx = 0; sx < SUB; sx++) blocked[(ty * SUB + sy) * gw + tx * SUB + sx] = 1
    }
  }
  for (const r of source.blockers) {
    const x0 = Math.max(0, Math.floor(r.x * SUB))
    const y0 = Math.max(0, Math.floor(r.y * SUB))
    const x1 = Math.min(gw, Math.ceil((r.x + r.w) * SUB))
    const y1 = Math.min(gh, Math.ceil((r.y + r.h) * SUB))
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) blocked[y * gw + x] = 1
  }

  const cellBlocked = (cx: number, cy: number) =>
    cx < 0 || cy < 0 || cx >= gw || cy >= gh || blocked[cy * gw + cx] === 1

  // is a box with these half extents around the point free?
  function boxFree(x: number, z: number, halfW: number, halfD: number) {
    const x0 = Math.floor((x - halfW) * SUB)
    const x1 = Math.ceil((x + halfW) * SUB) - 1
    const z0 = Math.floor((z - halfD) * SUB)
    const z1 = Math.ceil((z + halfD) * SUB) - 1
    for (let cy = z0; cy <= z1; cy++)
      for (let cx = x0; cx <= x1; cx++) if (cellBlocked(cx, cy)) return false
    return true
  }

  // is the player's feet box free at this position?
  function isFree(x: number, z: number) {
    return boxFree(x, z, HALF_W, HALF_D)
  }

  // move by (dx, dz) and slide along walls, like arcade physics does
  function move(x: number, z: number, dx: number, dz: number) {
    // small steps so fast frames don't tunnel through thin blockers
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (CELL * 0.5)))
    const sx = dx / steps
    const sz = dz / steps
    for (let i = 0; i < steps; i++) {
      if (sx && isFree(x + sx, z)) x += sx
      if (sz && isFree(x, z + sz)) z += sz
    }
    return { x, z }
  }

  // ---------- click to walk: A* on the quarter-tile grid ----------

  const cellCenter = (c: number) => (c + 0.5) * CELL
  // the cells where the player's box fits
  const clear = new Uint8Array(gw * gh)
  for (let cy = 0; cy < gh; cy++)
    for (let cx = 0; cx < gw; cx++)
      clear[cy * gw + cx] = isFree(cellCenter(cx), cellCenter(cy)) ? 1 : 0

  // the free cell closest to a point, e.g. when clicking on a table
  function nearestClearCell(x: number, z: number, maxRadius = 12) {
    const ox = Math.floor(x * SUB)
    const oy = Math.floor(z * SUB)
    for (let r = 0; r <= maxRadius; r++) {
      let best = -1
      let bestD = Infinity
      for (let cy = oy - r; cy <= oy + r; cy++)
        for (let cx = ox - r; cx <= ox + r; cx++) {
          if (Math.max(Math.abs(cx - ox), Math.abs(cy - oy)) !== r) continue
          if (cx < 0 || cy < 0 || cx >= gw || cy >= gh || !clear[cy * gw + cx]) continue
          const d = (cellCenter(cx) - x) ** 2 + (cellCenter(cy) - z) ** 2
          if (d < bestD) {
            bestD = d
            best = cy * gw + cx
          }
        }
      if (best >= 0) return best
    }
    return -1
  }

  // is the straight line between two points walkable? The box is checked at steps along
  // the line, grown by half a step, so it also covers the way between two steps and a
  // shortcut never cuts the corner of a wall.
  function lineFree(ax: number, az: number, bx: number, bz: number) {
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.ceil(len / (CELL * 0.5)))
    const growX = Math.abs(bx - ax) / n / 2
    const growZ = Math.abs(bz - az) / n / 2
    for (let i = 0; i <= n; i++) {
      const k = i / n
      if (!boxFree(ax + (bx - ax) * k, az + (bz - az) * k, HALF_W + growX, HALF_D + growZ))
        return false
    }
    return true
  }

  // the cell a player can step to from `current` by (dx, dy), or -1 (no cutting corners)
  function step(current: number, dx: number, dy: number) {
    const cx = current % gw
    const cy = Math.floor(current / gw)
    const nx = cx + dx
    const ny = cy + dy
    if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) return -1
    const next = ny * gw + nx
    if (!clear[next]) return -1
    if (dx && dy && (!clear[cy * gw + nx] || !clear[ny * gw + cx])) return -1
    return next
  }

  // a smoothed list of waypoints from (x, z) to the walkable point closest to the target
  function findPath(x: number, z: number, tx: number, tz: number): Path | null {
    const start = nearestClearCell(x, z, 3)
    const goal = nearestClearCell(tx, tz)
    if (start < 0 || goal < 0) return null
    const gx = goal % gw
    const gy = Math.floor(goal / gw)
    const cost = new Float32Array(gw * gh).fill(Infinity)
    const from = new Int32Array(gw * gh).fill(-1)
    const closed = new Uint8Array(gw * gh)
    const open = new MinHeap()
    cost[start] = 0
    open.push(start, 0)
    let found = false
    while (open.size) {
      const current = open.pop()
      if (closed[current]) continue
      closed[current] = 1
      if (current === goal) {
        found = true
        break
      }
      for (const [dx, dy, length] of DIRS) {
        const next = step(current, dx, dy)
        if (next < 0) continue
        const c = cost[current] + length
        if (c >= cost[next]) continue
        cost[next] = c
        from[next] = current
        open.push(next, c + Math.hypot(gx - (next % gw), gy - Math.floor(next / gw)))
      }
    }
    if (!found) return null

    const cells: Path = []
    for (let c = goal; c !== -1; c = from[c])
      cells.push({ x: cellCenter(c % gw), z: cellCenter(Math.floor(c / gw)) })
    cells.reverse()
    // the exact target if it is walkable, otherwise the closest free cell
    if (isFree(tx, tz)) cells[cells.length - 1] = { x: tx, z: tz }

    // string pulling: skip every waypoint that can be reached in a straight line
    const path: Path = []
    let from0 = { x, z }
    let i = 0
    while (i < cells.length) {
      let j = cells.length - 1
      while (j > i && !lineFree(from0.x, from0.z, cells[j].x, cells[j].z)) j--
      path.push(cells[j])
      from0 = cells[j]
      i = j + 1
    }
    return path
  }

  // every cell a player can walk to from (x, z), for the editor's reachability check
  function reachableFrom(x: number, z: number) {
    const reached = new Uint8Array(gw * gh)
    const start = nearestClearCell(x, z, 3)
    if (start < 0) return reached
    const queue = [start]
    reached[start] = 1
    while (queue.length) {
      const current = queue.pop()!
      for (const [dx, dy] of DIRS) {
        const next = step(current, dx, dy)
        if (next < 0 || reached[next]) continue
        reached[next] = 1
        queue.push(next)
      }
    }
    return reached
  }

  return {
    width: gw,
    height: gh,
    blocked,
    clear,
    isFree,
    move,
    findPath,
    reachableFrom,
    cellAt: (x: number, z: number) => Math.floor(z * SUB) * gw + Math.floor(x * SUB),
  }
}

export type Collision = ReturnType<typeof createCollision>
