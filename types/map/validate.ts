// Validation of map files: the server checks the map at start, the client checks what the
// server sends, and the editor checks imported files. Map files are untrusted input, so the
// result is a fresh copy with only the known fields, and every problem names the place in
// the file (e.g. `placements[3].x`).
import { BUILTIN_ASSETS, findAsset, isBuiltinAsset } from './catalog.ts'
import {
  ASSET_CATEGORIES,
  ASSET_MOUNTS,
  MAP_FORMAT,
  MAP_VERSION,
  ROTATIONS,
  TILE_KINDS,
  TILE_SIZE,
  ZONE_TYPES,
  type AssetCategory,
  type AssetMount,
  type MapAsset,
  type MapLabel,
  type MapZone,
  type Placement,
  type Rotation,
  type TileKind,
  type TileType,
  type VirtualOfficeMap,
  type ZoneType,
} from './format.ts'

export type MapIssue = { path: string; message: string }

export type MapValidation = { ok: true; map: VirtualOfficeMap } | { ok: false; errors: MapIssue[] }

export const MAP_LIMITS = {
  // tiles per side
  maxSize: 256,
  maxTileTypes: 64,
  maxLabels: 200,
  maxZones: 200,
  maxAssets: 100,
  maxPlacements: 5000,
  // tiles per side of a placement or an asset
  maxFootprint: 64,
  // tiles per side of a collision mask
  maxSolid: 32,
  maxText: 80,
  // characters of a map file
  maxFileSize: 5_000_000,
} as const

// ids end up in room names (zone-<id>, computer-<id>), so only plain characters
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
// one visible ASCII character except space, quote and backslash
const TILE_KEY_PATTERN = /^[!#-[\]-~]$/
// a path below models/: plain segments that can't be "." or "..", no scheme, no query
const MODEL_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*\.(glb|gltf)$/i
const MAX_ISSUES = 100
const EPSILON = 1e-9

export class MapValidationError extends Error {
  readonly issues: MapIssue[]
  constructor(issues: MapIssue[], source = 'map') {
    super(`Invalid ${source}:\n${describeIssues(issues)}`)
    this.name = 'MapValidationError'
    this.issues = issues
  }
}

// the problems as lines for logs and messages, at most `max`
export function describeIssues(issues: MapIssue[], max = 20) {
  const lines = issues
    .slice(0, max)
    .map((issue) => `  - ${issue.path ? `${issue.path}: ` : ''}${issue.message}`)
  if (issues.length > max) lines.push(`  … and ${issues.length - max} more`)
  return lines.join('\n')
}

// why a model path isn't acceptable, or null: only files below the client's models/ folder
export function checkModelSource(src: unknown): string | null {
  if (typeof src !== 'string' || !src) return 'must be a path like "furniture/sofa.glb"'
  if (src.length > 200) return 'is too long (at most 200 characters)'
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//'))
    return 'must be a relative path below models/, not a URL'
  if (src.startsWith('/') || src.includes('\\')) return 'must be a relative path below models/'
  if (src.split('/').some((segment) => segment === '..' || segment === '.'))
    return 'must not leave the models/ folder ("." and ".." are not allowed)'
  if (!MODEL_PATTERN.test(src))
    return 'must be a .glb or .gltf file with letters, digits, "-", "_" and "." in its path'
  return null
}

// the URL a model is loaded from, below the client's base URL
export const modelUrl = (src: string, base = '/') => `${base.replace(/\/?$/, '/')}models/${src}`

type Obj = Record<string, unknown>

class Checker {
  issues: MapIssue[] = []

  add(path: string, message: string) {
    if (this.issues.length < MAX_ISSUES) this.issues.push({ path, message })
  }

  get full() {
    return this.issues.length >= MAX_ISSUES
  }

  // `allowed`: the known properties, null for free-form keys (checked by the caller)
  object(value: unknown, path: string, allowed: readonly string[] | null): Obj | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.add(path, 'must be an object')
      return null
    }
    if (allowed)
      for (const key of Object.keys(value))
        if (!allowed.includes(key)) this.add(path, `unknown property "${key}"`)
    return value as Obj
  }

  array(value: unknown, path: string, max: number): unknown[] | null {
    if (!Array.isArray(value)) {
      this.add(path, 'must be a list')
      return null
    }
    if (value.length > max) {
      this.add(path, `has ${value.length} entries, at most ${max} are allowed`)
      return null
    }
    return value
  }

  string(value: unknown, path: string, max: number = MAP_LIMITS.maxText): string | null {
    if (typeof value !== 'string') {
      this.add(path, 'must be a text')
      return null
    }
    if (!value.trim()) {
      this.add(path, 'must not be empty')
      return null
    }
    if (value.length > max) {
      this.add(path, `is too long (${value.length} characters, at most ${max})`)
      return null
    }
    return value
  }

  id(value: unknown, path: string, seen: Set<string>): string | null {
    if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
      this.add(
        path,
        'must be an id of letters, digits, "-", "_" and "." (up to 64, starting with a letter or digit)'
      )
      return null
    }
    if (seen.has(value)) {
      this.add(path, `"${value}" is used twice, ids must be unique`)
      return null
    }
    seen.add(value)
    return value
  }

  number(
    value: unknown,
    path: string,
    { min = -Infinity, max = Infinity, integer = false, above = false } = {}
  ): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.add(path, 'must be a number')
      return null
    }
    if (integer && !Number.isInteger(value)) {
      this.add(path, 'must be a whole number')
      return null
    }
    if (above ? value <= min : value < min) {
      this.add(path, `must be ${above ? 'greater than' : 'at least'} ${min}`)
      return null
    }
    if (value > max) {
      this.add(path, `must be at most ${max}`)
      return null
    }
    return value
  }

  boolean(value: unknown, path: string): boolean | null {
    if (typeof value !== 'boolean') {
      this.add(path, 'must be true or false')
      return null
    }
    return value
  }

  color(value: unknown, path: string): string | null {
    if (typeof value !== 'string' || !COLOR_PATTERN.test(value)) {
      this.add(path, 'must be a colour like "#a1b2c3"')
      return null
    }
    return value.toLowerCase()
  }

  oneOf<T extends string | number>(value: unknown, path: string, options: readonly T[]): T | null {
    if (!options.includes(value as T)) {
      this.add(path, `must be one of ${options.map((o) => JSON.stringify(o)).join(', ')}`)
      return null
    }
    return value as T
  }
}

const MAP_KEYS = [
  'format',
  'version',
  'name',
  'tileSize',
  'width',
  'height',
  'tileTypes',
  'tiles',
  'spawn',
  'labels',
  'zones',
  'assets',
  'placements',
]

function looksLikeTiled(value: Obj) {
  return 'tiledversion' in value || ('layers' in value && 'tilesets' in value)
}

export function validateMap(input: unknown): MapValidation {
  const c = new Checker()
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: [{ path: '', message: 'a map must be a JSON object' }] }
  }
  const raw = input as Obj
  if (raw.format !== MAP_FORMAT) {
    const message = looksLikeTiled(raw)
      ? 'this is a Tiled map; VirtualOffice no longer reads Tiled maps, only its own format'
      : `must be "${MAP_FORMAT}", this is not a VirtualOffice map`
    return { ok: false, errors: [{ path: 'format', message }] }
  }
  if (raw.version !== MAP_VERSION) {
    const newer = typeof raw.version === 'number' && raw.version > MAP_VERSION
    const message = newer
      ? `version ${raw.version} is newer than this VirtualOffice understands (${MAP_VERSION})`
      : `must be ${MAP_VERSION}`
    return { ok: false, errors: [{ path: 'version', message }] }
  }
  c.object(raw, '', MAP_KEYS)

  const name = c.string(raw.name, 'name')
  const tileSize = raw.tileSize === TILE_SIZE ? TILE_SIZE : null
  if (tileSize === null)
    c.add('tileSize', `must be ${TILE_SIZE} (the map pixels per tile of the network protocol)`)
  const sizeLimits = { min: 1, max: MAP_LIMITS.maxSize, integer: true }
  const width = c.number(raw.width, 'width', sizeLimits)
  const height = c.number(raw.height, 'height', sizeLimits)

  // ---- the legend and the grid ----
  // the keys are checked one by one below, so "__proto__" & co. never become keys
  const tileTypes: Record<string, TileType> = {}
  // keys with a valid name, even if their type has problems (reported once, not per tile)
  const declared = new Set<string>()
  const tileTypesRaw = c.object(raw.tileTypes, 'tileTypes', null)
  if (tileTypesRaw) {
    const entries = Object.entries(tileTypesRaw)
    if (!entries.length) c.add('tileTypes', 'must define at least one tile type')
    if (entries.length > MAP_LIMITS.maxTileTypes)
      c.add('tileTypes', `has ${entries.length} types, at most ${MAP_LIMITS.maxTileTypes}`)
    for (const [key, value] of entries.slice(0, MAP_LIMITS.maxTileTypes)) {
      const path = `tileTypes[${JSON.stringify(key)}]`
      if (!TILE_KEY_PATTERN.test(key)) {
        c.add(path, 'the key must be one visible ASCII character (no space, quote or backslash)')
        continue
      }
      declared.add(key)
      const tile = c.object(value, path, ['kind', 'name', 'color'])
      if (!tile) continue
      const kind = c.oneOf<TileKind>(tile.kind, `${path}.kind`, TILE_KINDS)
      const tileName = c.string(tile.name, `${path}.name`, 40)
      let color: string | null | undefined
      if (kind === 'void') {
        if (tile.color !== undefined) c.add(`${path}.color`, 'void tiles have no colour')
      } else if (kind) {
        color = c.color(tile.color, `${path}.color`)
      }
      if (kind && tileName && color !== null)
        tileTypes[key] = color ? { kind, name: tileName, color } : { kind, name: tileName }
    }
  }

  const tiles: string[] = []
  // whether every tile of the grid is known, so tiles can be looked up
  let gridOk = false
  const rows = c.array(raw.tiles, 'tiles', MAP_LIMITS.maxSize)
  if (rows && width !== null && height !== null) {
    gridOk = rows.length === height
    if (!gridOk) c.add('tiles', `has ${rows.length} rows, the map is ${height} tiles high`)
    rows.forEach((row, y) => {
      if (typeof row !== 'string') {
        gridOk = false
        return c.add(`tiles[${y}]`, 'must be a text')
      }
      if (row.length !== width) {
        gridOk = false
        c.add(`tiles[${y}]`, `has ${row.length} characters, the map is ${width} tiles wide`)
      }
      const unknown = new Set<string>()
      for (const char of row) {
        if (Object.hasOwn(tileTypes, char)) continue
        gridOk = false
        if (!declared.has(char)) unknown.add(char)
      }
      for (const char of unknown)
        c.add(
          `tiles[${y}]`,
          `unknown tile type ${JSON.stringify(char)} (column ${row.indexOf(char)})`
        )
      tiles.push(row)
    })
  }
  const kindAt = (x: number, y: number): TileKind | undefined =>
    gridOk ? tileTypes[tiles[Math.floor(y)][Math.floor(x)]].kind : undefined

  // inside the map, with some slack for numbers like 0.1 + 0.2
  const W = width ?? Infinity
  const H = height ?? Infinity
  const rectInside = (path: string, x: number, y: number, w: number, h: number) => {
    if (x < -EPSILON || y < -EPSILON || x + w > W + EPSILON || y + h > H + EPSILON)
      c.add(path, `(${x}, ${y}, ${w} x ${h}) is not inside the ${W} x ${H} map`)
  }

  // ---- spawn ----
  let spawn: VirtualOfficeMap['spawn'] | null = null
  const spawnRaw = c.object(raw.spawn, 'spawn', ['x', 'y'])
  if (spawnRaw) {
    const x = c.number(spawnRaw.x, 'spawn.x', { min: 0, max: W })
    const y = c.number(spawnRaw.y, 'spawn.y', { min: 0, max: H })
    if (x !== null && y !== null) {
      spawn = { x, y }
      if (x >= W || y >= H) c.add('spawn', 'must be inside the map')
      else if (gridOk && kindAt(x, y) !== 'floor')
        c.add('spawn', `(${x}, ${y}) must be on a floor tile, not on ${kindAt(x, y)}`)
    }
  }

  // ---- labels ----
  const labels: MapLabel[] = []
  const labelIds = new Set<string>()
  const labelList = c.array(raw.labels ?? [], 'labels', MAP_LIMITS.maxLabels) ?? []
  labelList.forEach((value, i) => {
    const path = `labels[${i}]`
    const label = c.object(value, path, ['id', 'text', 'x', 'y'])
    if (!label) return
    const id = c.id(label.id, `${path}.id`, labelIds)
    const text = c.string(label.text, `${path}.text`, 60)
    const x = c.number(label.x, `${path}.x`, { min: 0, max: W })
    const y = c.number(label.y, `${path}.y`, { min: 0, max: H })
    if (id !== null && text !== null && x !== null && y !== null) labels.push({ id, text, x, y })
  })

  // ---- zones ----
  const zones: MapZone[] = []
  const zoneIds = new Set<string>()
  const zoneList = c.array(raw.zones ?? [], 'zones', MAP_LIMITS.maxZones) ?? []
  zoneList.forEach((value, i) => {
    const path = `zones[${i}]`
    const zone = c.object(value, path, ['id', 'name', 'type', 'x', 'y', 'w', 'h'])
    if (!zone) return
    const id = c.id(zone.id, `${path}.id`, zoneIds)
    const zoneName = c.string(zone.name, `${path}.name`, 60)
    const type = c.oneOf<ZoneType>(zone.type, `${path}.type`, ZONE_TYPES)
    const x = c.number(zone.x, `${path}.x`)
    const y = c.number(zone.y, `${path}.y`)
    const w = c.number(zone.w, `${path}.w`, { min: 0, above: true })
    const h = c.number(zone.h, `${path}.h`, { min: 0, above: true })
    if (id === null || zoneName === null || type === null) return
    if (x === null || y === null || w === null || h === null) return
    rectInside(path, x, y, w, h)
    zones.push({ id, name: zoneName, type, x, y, w, h })
  })

  // ---- assets of the map (local models) ----
  const assets: MapAsset[] = []
  const assetIds = new Set<string>()
  const assetList = c.array(raw.assets ?? [], 'assets', MAP_LIMITS.maxAssets) ?? []
  assetList.forEach((value, i) => {
    const path = `assets[${i}]`
    const asset = c.object(value, path, [
      'id',
      'name',
      'category',
      'w',
      'h',
      'collides',
      'mount',
      'model',
    ])
    if (!asset) return
    const id = c.id(asset.id, `${path}.id`, assetIds)
    if (id !== null && isBuiltinAsset(id))
      c.add(`${path}.id`, `"${id}" is a built-in asset, choose another id`)
    const assetName = c.string(asset.name, `${path}.name`, 40)
    const category = c.oneOf<AssetCategory>(asset.category, `${path}.category`, ASSET_CATEGORIES)
    const size = { min: 0, max: MAP_LIMITS.maxFootprint, above: true }
    const w = c.number(asset.w, `${path}.w`, size)
    const h = c.number(asset.h, `${path}.h`, size)
    const collides = c.boolean(asset.collides, `${path}.collides`)
    const mount =
      asset.mount === undefined
        ? undefined
        : c.oneOf<AssetMount>(asset.mount, `${path}.mount`, ASSET_MOUNTS)
    const model = c.object(asset.model, `${path}.model`, ['src', 'scale'])
    let source: MapAsset['model'] | null = null
    if (model) {
      const problem = checkModelSource(model.src)
      if (problem) c.add(`${path}.model.src`, problem)
      const scale =
        model.scale === undefined
          ? undefined
          : c.number(model.scale, `${path}.model.scale`, { min: 0, max: 100, above: true })
      if (!problem && scale !== null)
        source =
          scale === undefined ? { src: model.src as string } : { src: model.src as string, scale }
    }
    if (id === null || isBuiltinAsset(id) || assetName === null || category === null) return
    if (w === null || h === null || collides === null || mount === null || !source) return
    assets.push({
      id,
      name: assetName,
      category,
      w,
      h,
      collides,
      ...(mount ? { mount } : {}),
      model: source,
    })
  })

  // ---- placements ----
  const placements: Placement[] = []
  const placementIds = new Set<string>()
  const placementList = c.array(raw.placements ?? [], 'placements', MAP_LIMITS.maxPlacements) ?? []
  const known = BUILTIN_ASSETS.map((a) => a.id).join(', ')
  for (let i = 0; i < placementList.length && !c.full; i++) {
    const path = `placements[${i}]`
    const p = c.object(placementList[i], path, [
      'id',
      'asset',
      'x',
      'y',
      'w',
      'h',
      'rotation',
      'color',
      'collides',
      'solid',
    ])
    if (!p) continue
    const id = c.id(p.id, `${path}.id`, placementIds)
    let assetId: string | null = null
    if (typeof p.asset !== 'string' || !p.asset) c.add(`${path}.asset`, 'must be an asset id')
    else if (!findAsset({ assets }, p.asset) && !assetList.some((a) => (a as Obj)?.id === p.asset))
      c.add(
        `${path}.asset`,
        `unknown asset "${p.asset}" (built in: ${known}; or define it in "assets")`
      )
    else assetId = p.asset
    const x = c.number(p.x, `${path}.x`)
    const y = c.number(p.y, `${path}.y`)
    const size = { min: 0, max: MAP_LIMITS.maxFootprint, above: true }
    const w = c.number(p.w, `${path}.w`, size)
    const h = c.number(p.h, `${path}.h`, size)
    const rotation =
      p.rotation === undefined
        ? undefined
        : c.oneOf<Rotation>(p.rotation, `${path}.rotation`, ROTATIONS)
    // like the editor, only assets marked rotatable in the catalog can be turned
    if (rotation && assetId !== null && findAsset({ assets }, assetId)?.rotatable === false)
      c.add(`${path}.rotation`, `must be 0, "${assetId}" can't be turned`)
    const color = p.color === undefined ? undefined : c.color(p.color, `${path}.color`)
    const collides =
      p.collides === undefined ? undefined : c.boolean(p.collides, `${path}.collides`)
    let solid: string[] | undefined | null
    if (p.solid !== undefined) {
      solid = null
      const mask = c.array(p.solid, `${path}.solid`, MAP_LIMITS.maxSolid)
      if (mask && w !== null && h !== null) {
        if (!Number.isInteger(w) || !Number.isInteger(h) || w > MAP_LIMITS.maxSolid)
          c.add(
            `${path}.solid`,
            `needs a footprint of whole tiles (at most ${MAP_LIMITS.maxSolid})`
          )
        else if (mask.length !== h) c.add(`${path}.solid`, `needs ${h} rows, one per tile of h`)
        else if (
          mask.some((row) => typeof row !== 'string' || !/^[#.]*$/.test(row) || row.length !== w)
        )
          c.add(`${path}.solid`, `rows must be ${w} characters of "#" (blocks) and "." (free)`)
        else solid = mask as string[]
      }
    }
    if (id === null || assetId === null || x === null || y === null || w === null || h === null)
      continue
    if (rotation === null || color === null || collides === null || solid === null) continue
    rectInside(path, x, y, w, h)
    placements.push({
      id,
      asset: assetId,
      x,
      y,
      w,
      h,
      ...(rotation !== undefined ? { rotation } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(collides !== undefined ? { collides } : {}),
      ...(solid !== undefined ? { solid: [...solid] } : {}),
    })
  }

  if (c.issues.length || name === null || width === null || height === null || !spawn)
    return {
      ok: false,
      errors: c.issues.length ? c.issues : [{ path: '', message: 'invalid map' }],
    }
  return {
    ok: true,
    map: {
      format: MAP_FORMAT,
      version: MAP_VERSION,
      name,
      tileSize: TILE_SIZE,
      width,
      height,
      tileTypes,
      tiles,
      spawn,
      labels,
      zones,
      assets,
      placements,
    },
  }
}

// a map file's text: JSON syntax and the map itself
export function parseMap(text: string): MapValidation {
  if (text.length > MAP_LIMITS.maxFileSize)
    return {
      ok: false,
      errors: [
        { path: '', message: `the file is too big (at most ${MAP_LIMITS.maxFileSize} characters)` },
      ],
    }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      errors: [{ path: '', message: `not valid JSON: ${(error as Error).message}` }],
    }
  }
  return validateMap(json)
}

// the validated map, or a MapValidationError listing the problems
export function assertValidMap(input: unknown, source?: string): VirtualOfficeMap {
  const result = validateMap(input)
  // (=== false: the server compiles without strictNullChecks, where !ok doesn't narrow)
  if (result.ok === false) throw new MapValidationError(result.errors, source)
  return result.map
}
