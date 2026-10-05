import { findAsset } from '../../../types/map/catalog'
import type { VirtualOfficeMap } from '../../../types/map/format'
import { validateMap, type MapIssue } from '../../../types/map/validate'
import { createCollision, SUB } from '../map/collision'
import { compileOffice, type OfficeData } from '../map/compile'
import { interactablesOf, approachPoint } from '../game/interactables'
import { wallFaceZ } from '../map/office'

// What the editor tells about a map: the errors that stop it from being used (the same
// validation as the server's) and hints about things players will notice, found with the
// collision of the game itself.

export type MapWarning = { message: string; ids: string[] }

export type MapReport = {
  errors: MapIssue[]
  warnings: MapWarning[]
  // the map as the 3D client sees it; also with errors like a spawn in a wall, so the
  // preview keeps working while they are fixed
  office: OfficeData | null
}

const list = (ids: string[], max = 6) =>
  ids.length > max ? `${ids.slice(0, max).join(', ')} … (+${ids.length - max})` : ids.join(', ')

function compileAnyway(map: VirtualOfficeMap) {
  try {
    return compileOffice(map)
  } catch {
    return null
  }
}

export function analyzeMap(map: VirtualOfficeMap): MapReport {
  const result = validateMap(map)
  if (!result.ok) return { errors: result.errors, warnings: [], office: compileAnyway(map) }
  const office = compileOffice(result.map)
  const collision = createCollision(office)
  const warnings: MapWarning[] = []

  const { spawn } = office
  if (!collision.isFree(spawn.x, spawn.z))
    warnings.push({ message: 'Der Startpunkt ist blockiert (Möbel oder Wand im Weg).', ids: [] })

  // what a player can walk to from the spawn: a cell within `radius` cells of the point
  // (players walk to the free spot next to a thing and use it from there; a chair at a
  // desk may stand half in the desk, sitting down puts the player on the seat)
  const reached = collision.reachableFrom(spawn.x, spawn.z)
  const reachable = (x: number, z: number, radius: number) => {
    const cx = Math.floor(x * SUB)
    const cz = Math.floor(z * SUB)
    for (let dz = -radius; dz <= radius; dz++)
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx
        const nz = cz + dz
        if (nx < 0 || nz < 0 || nx >= collision.width || nz >= collision.height) continue
        if (reached[nz * collision.width + nx]) return true
      }
    return false
  }
  const items = interactablesOf(office)
  const lonelyChairs = items.chairs.filter((c) => !reachable(c.x, c.z, SUB)).map((c) => c.id)
  if (lonelyChairs.length)
    warnings.push({
      message: `${lonelyChairs.length} Stuhl/Stühle sind vom Startpunkt aus nicht erreichbar: ${list(lonelyChairs)}`,
      ids: lonelyChairs,
    })
  const lonelyItems = [...items.computers, ...items.vendingMachines]
    .filter((item) => {
      // the sides of the item a player could stand at
      const r = item.rect
      return ![
        approachPoint(item, r.x + r.w / 2, r.y - 1),
        approachPoint(item, r.x + r.w / 2, r.y + r.h + 1),
        approachPoint(item, r.x - 1, r.y + r.h / 2),
        approachPoint(item, r.x + r.w + 1, r.y + r.h / 2),
      ].some((p) => reachable(p.x, p.z, 2))
    })
    .map((item) => item.id)
  if (lonelyItems.length)
    warnings.push({
      message: `Nicht erreichbar: ${list(lonelyItems)} (Computer/Getränkeautomaten)`,
      ids: lonelyItems,
    })

  // things on the floor that stand in a wall or in the void
  const tileAt = (x: number, y: number) => office.rows[Math.floor(y)]?.[Math.floor(x)] ?? '.'
  const misplaced = office.map.placements
    .filter((p) => findAsset(office.map, p.asset)?.mount !== 'wall')
    .filter((p) => tileAt(p.x + p.w / 2, p.y + p.h / 2) !== 'f')
    .map((p) => p.id)
  if (misplaced.length)
    warnings.push({
      message: `Steht nicht auf dem Boden: ${list(misplaced)}`,
      ids: misplaced,
    })

  // pictures and screens need a wall with a floor in front
  const homeless = office.furniture
    .filter((f) => f.asset.mount === 'wall')
    .filter((f) => {
      const face = wallFaceZ(office, f)
      return face >= office.height || tileAt(f.x + f.w / 2, face - 1) !== '#'
    })
    .map((f) => f.id)
  if (homeless.length)
    warnings.push({
      message: `Hängt an keiner Wand (Wand mit Boden davor nötig): ${list(homeless)}`,
      ids: homeless,
    })

  return { errors: [], warnings, office }
}
