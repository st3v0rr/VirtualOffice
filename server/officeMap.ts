import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseOfficeMap } from '../types/OfficeMap.ts'

const MAP_FILE = path.join('assets', 'map', 'map.json')

// the Tiled map lives in assets/map at the repo root; search upwards so this works from
// the sources (tsx) as well as from the compiled output in server/lib
function findMapFile() {
  if (process.env.OFFICE_MAP_PATH) return process.env.OFFICE_MAP_PATH
  let dir = import.meta.dirname
  for (;;) {
    const candidate = path.join(dir, MAP_FILE)
    if (existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error(`Office map not found, set OFFICE_MAP_PATH`)
    dir = parent
  }
}

export const officeMap = parseOfficeMap(JSON.parse(readFileSync(findMapFile(), 'utf8')))
