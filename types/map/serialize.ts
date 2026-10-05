// Writes a map as JSON in one fixed layout: one line per tile row, label, zone, asset and
// placement, keys in a fixed order. Saving an unchanged map gives the same text, and a
// change in the editor shows up as a small diff of the map file.
import type { VirtualOfficeMap } from './format.ts'

const ORDER: Record<string, string[]> = {
  tileType: ['kind', 'name', 'color'],
  label: ['id', 'text', 'x', 'y'],
  zone: ['id', 'name', 'type', 'x', 'y', 'w', 'h'],
  asset: ['id', 'name', 'category', 'w', 'h', 'collides', 'mount', 'model'],
  model: ['src', 'scale'],
  placement: ['id', 'asset', 'x', 'y', 'w', 'h', 'rotation', 'color', 'collides', 'solid'],
}

// an object on one line, with its known keys in order (missing ones left out)
function inline(value: Record<string, unknown>, order: string[]): string {
  const parts = order
    .filter((key) => value[key] !== undefined)
    .map((key) => {
      const v = value[key]
      const text =
        key === 'model'
          ? inline(v as Record<string, unknown>, ORDER.model)
          : Array.isArray(v)
            ? `[${v.map((item) => JSON.stringify(item)).join(', ')}]`
            : JSON.stringify(v)
      return `${JSON.stringify(key)}: ${text}`
    })
  return `{ ${parts.join(', ')} }`
}

function list(items: string[]) {
  return items.length ? `[\n${items.map((item) => `    ${item}`).join(',\n')}\n  ]` : '[]'
}

export function formatMap(map: VirtualOfficeMap): string {
  const tileTypes = Object.entries(map.tileTypes).map(
    ([key, type]) => `    ${JSON.stringify(key)}: ${inline(type, ORDER.tileType)}`
  )
  const lines = [
    `  "format": ${JSON.stringify(map.format)}`,
    `  "version": ${map.version}`,
    `  "name": ${JSON.stringify(map.name)}`,
    `  "tileSize": ${map.tileSize}`,
    `  "width": ${map.width}`,
    `  "height": ${map.height}`,
    `  "tileTypes": {\n${tileTypes.join(',\n')}\n  }`,
    `  "tiles": ${list(map.tiles.map((row) => JSON.stringify(row)))}`,
    `  "spawn": ${inline(map.spawn, ['x', 'y'])}`,
    `  "labels": ${list(map.labels.map((l) => inline(l, ORDER.label)))}`,
    `  "zones": ${list(map.zones.map((z) => inline(z, ORDER.zone)))}`,
    `  "assets": ${list(map.assets.map((a) => inline(a, ORDER.asset)))}`,
    `  "placements": ${list(map.placements.map((p) => inline(p, ORDER.placement)))}`,
  ]
  return `{\n${lines.join(',\n')}\n}\n`
}
