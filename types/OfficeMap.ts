// the parts of the map that both the server and the clients need, in map pixels as they
// go over the wire (see map/format.ts)
import { findAsset } from './map/catalog.ts'
import { tileToWire, type VirtualOfficeMap, type ZoneType } from './map/format.ts'

export { ZONE_TYPES, type ZoneType } from './map/format.ts'

// a media zone in map pixels
export type Zone = {
  id: string
  name: string
  type: ZoneType
  x: number
  y: number
  width: number
  height: number
}

export type OfficeMap = {
  // the ids of the computers, used as keys of the room state and in media room names
  computerIds: string[]
  // where players appear, as a position on the wire
  spawn: { x: number; y: number }
  zones: Zone[]
}

const px = (tiles: number, tileSize: number) => Math.round(tiles * tileSize * 1000) / 1000

export function zonesInPixels(map: VirtualOfficeMap): Zone[] {
  return map.zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    type: zone.type,
    x: px(zone.x, map.tileSize),
    y: px(zone.y, map.tileSize),
    width: px(zone.w, map.tileSize),
    height: px(zone.h, map.tileSize),
  }))
}

export function officeMapInfo(map: VirtualOfficeMap): OfficeMap {
  return {
    computerIds: map.placements
      .filter((p) => findAsset(map, p.asset)?.role === 'computer')
      .map((p) => p.id),
    spawn: tileToWire(map.spawn.x, map.spawn.y, map.tileSize),
    zones: zonesInPixels(map),
  }
}

// the smallest zone containing the point, so a stage inside an auditorium wins
export function findZone(zones: Zone[], x: number, y: number): Zone | undefined {
  let found: Zone | undefined
  for (const zone of zones) {
    const inside = x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.height
    if (inside && (!found || zone.width * zone.height < found.width * found.height)) found = zone
  }
  return found
}
