// reads the parts of the Tiled map that both client and server need

export const ZONE_TYPES = ['meeting', 'focus', 'quiet', 'auditorium', 'stage'] as const
export type ZoneType = (typeof ZONE_TYPES)[number]

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
  computerIds: string[]
  whiteboardIds: string[]
  spawn: { x: number; y: number }
  zones: Zone[]
}

type TiledProperty = { name: string; value: unknown }

export type TiledObject = {
  id: number
  name?: string
  type?: string
  class?: string
  x: number
  y: number
  width?: number
  height?: number
  gid?: number
  properties?: TiledProperty[]
}

type TiledLayer = { name: string; type: string; objects?: TiledObject[] }

export type TiledMap = { layers: TiledLayer[] }

// fallback for maps without a Spawn layer
const DEFAULT_SPAWN = { x: 705, y: 500 }

export function getProperty<T>(object: { properties?: unknown }, name: string) {
  // Tiled exports properties as a list, some loaders turn them into an object
  const { properties } = object
  if (Array.isArray(properties)) {
    return (properties as TiledProperty[]).find((property) => property.name === name)?.value as
      T | undefined
  }
  return (properties as Record<string, unknown> | undefined)?.[name] as T | undefined
}

export function getObjects(map: TiledMap, layerName: string) {
  return map.layers.find((layer) => layer.name === layerName)?.objects ?? []
}

function toZone(object: TiledObject): Zone | null {
  // the zone type can be set as Tiled class/type or as a custom property
  const type = object.class || object.type || getProperty<string>(object, 'type')
  if (!ZONE_TYPES.includes(type as ZoneType) || !object.width || !object.height) return null
  return {
    id: String(object.id),
    name: object.name || type!,
    type: type as ZoneType,
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
  }
}

export function parseOfficeMap(map: TiledMap): OfficeMap {
  const spawn = getObjects(map, 'Spawn')[0]
  return {
    // items are identified by their Tiled object id, so the ids stay stable when the map changes
    computerIds: getObjects(map, 'Computer').map((object) => String(object.id)),
    whiteboardIds: getObjects(map, 'Whiteboard').map((object) => String(object.id)),
    spawn: spawn ? { x: spawn.x, y: spawn.y } : DEFAULT_SPAWN,
    zones: getObjects(map, 'Zones')
      .map(toZone)
      .filter((zone) => zone !== null),
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
