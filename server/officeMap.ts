import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { VirtualOfficeMap } from '../types/map/format.ts'
import { MapValidationError, parseMap } from '../types/map/validate.ts'
import { officeMapInfo } from '../types/OfficeMap.ts'

const MAP_FILE = path.join('assets', 'map', 'office.json')

// OFFICE_MAP_PATH, or the map in assets/map at the repo root; searched upwards so this works
// from the sources (tsx) as well as from the compiled output in server/lib
export function findMapFile(env: NodeJS.ProcessEnv = process.env, start = import.meta.dirname) {
  if (env.OFFICE_MAP_PATH) return env.OFFICE_MAP_PATH
  let dir = start
  for (;;) {
    const candidate = path.join(dir, MAP_FILE)
    if (existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error(`Office map not found, set OFFICE_MAP_PATH`)
    dir = parent
  }
}

// the map of a file, checked like any other upload: a broken map stops the server at the
// start with the list of its problems, instead of failing for the players later
export function loadMapFile(file: string): VirtualOfficeMap {
  const result = parseMap(readFileSync(file, 'utf8'))
  if (result.ok === false) throw new MapValidationError(result.errors, `office map ${file}`)
  return result.map
}

export const officeMapFile = findMapFile()
// the whole map, served to the clients at /map.json
export const officeMapData = loadMapFile(officeMapFile)
// what the rooms need: computers, spawn and media zones
export const officeMap = officeMapInfo(officeMapData)
