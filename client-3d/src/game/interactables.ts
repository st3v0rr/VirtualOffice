import { getOffice, type ChairData, type OfficeData, type TileRect } from '../map/office'
import { remotes, me } from '../net/players'

// Everything the player can use: chairs, computers and vending machines.

export type ChairItem = {
  kind: 'chair'
  id: string
  x: number
  z: number
  rot: number
  chair: ChairData
}
export type ComputerItem = { kind: 'computer'; id: string; x: number; z: number; rect: TileRect }
export type VendingItem = { kind: 'vending'; id: string; x: number; z: number; rect: TileRect }
export type Interactable = ChairItem | ComputerItem | VendingItem

export type Interactables = {
  chairs: ChairItem[]
  computers: ComputerItem[]
  vendingMachines: VendingItem[]
  all: Interactable[]
}

const cache = new WeakMap<OfficeData, Interactables>()

const rectOf = ({ x, y, w, h }: TileRect): TileRect => ({ x, y, w, h })

// the usable things of an office, by default of the one the game shows
export function interactablesOf(office: OfficeData = getOffice()): Interactables {
  let items = cache.get(office)
  if (items) return items
  const chairs = office.chairs.map((chair): ChairItem => ({
    kind: 'chair',
    id: chair.id,
    x: chair.x,
    z: chair.z,
    rot: chair.rot,
    chair,
  }))
  const computers = office.computers.map((item): ComputerItem => ({
    kind: 'computer',
    id: item.id,
    x: item.x + item.w / 2,
    z: item.y + item.h / 2,
    rect: rectOf(item),
  }))
  const vendingMachines = office.vendingMachines.map((item): VendingItem => ({
    kind: 'vending',
    id: item.id,
    x: item.x + item.w / 2,
    z: item.y + item.h / 2,
    rect: rectOf(item),
  }))
  items = { chairs, computers, vendingMachines, all: [...chairs, ...computers, ...vendingMachines] }
  cache.set(office, items)
  return items
}

const distToRect = (x: number, z: number, r: TileRect) => {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w))
  const dz = Math.max(r.y - z, 0, z - (r.y + r.h))
  return Math.hypot(dx, dz)
}

export function distanceTo(item: Interactable, x: number, z: number) {
  return item.kind === 'chair' ? Math.hypot(item.x - x, item.z - z) : distToRect(x, z, item.rect)
}

// a chair is taken when someone sits on it (players of the 2D client included)
export function chairOccupant(chairId: string): string | null {
  const chair = interactablesOf().chairs.find((c) => c.id === chairId)
  if (!chair) return null
  if (me.sittingOn === chairId) return 'me'
  for (const [id, remote] of remotes) {
    if (
      remote.state === 'sit' &&
      Math.hypot(remote.targetX - chair.x, remote.targetZ - chair.z) < 0.45
    )
      return id
  }
  return null
}

const REACH = { chair: 0.8, computer: 0.75, vending: 0.8 }

// the item in front of the player, preferring what it looks at
export function findNearby(
  x: number,
  z: number,
  rot: number,
  sitting: boolean
): Interactable | null {
  // look a little ahead, like the item selector of the 2D client
  const ax = x + Math.sin(rot) * 0.3
  const az = z + Math.cos(rot) * 0.3
  let best: Interactable | null = null
  let bestScore = Infinity
  for (const item of interactablesOf().all) {
    // while sitting only the things in front can be used, not the next chair
    if (item.kind === 'chair' && (sitting || chairOccupant(item.id))) continue
    const d = distanceTo(item, ax, az)
    const reach = REACH[item.kind] + (sitting ? 0.6 : 0)
    if (d > reach) continue
    if (d < bestScore) {
      bestScore = d
      best = item
    }
  }
  return best
}

// where to walk to use an item by clicking it
export function approachPoint(item: Interactable, x: number, z: number) {
  if (item.kind === 'chair') return { x: item.x, z: item.z }
  // the closest point next to the item's rectangle
  const r = item.rect
  const px = Math.min(Math.max(x, r.x), r.x + r.w)
  const pz = Math.min(Math.max(z, r.y), r.y + r.h)
  const dx = x - px
  const dz = z - pz
  const len = Math.hypot(dx, dz) || 1
  return { x: px + (dx / len) * 0.45, z: pz + (dz / len) * 0.45 }
}
