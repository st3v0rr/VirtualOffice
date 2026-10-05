// Checks a map file the way the server does at start, e.g. a map exported from the editor
// before it is deployed.
//
//   npm run validate-map                       assets/map/office.json
//   npm run validate-map -- ~/my-office.json   any other file
//
// Prints what the map contains, or every problem with its place in the file (exit code 1).
import fs from 'node:fs'
import path from 'node:path'
// plain TypeScript without enums, so Node runs it directly (type stripping, Node >= 22.18)
import { describeIssues, parseMap } from '../../types/map/validate.ts'
import { officeMapInfo } from '../../types/OfficeMap.ts'

const root = path.resolve(import.meta.dirname, '..', '..')
// npm runs scripts in the repo root; a relative path means the directory npm was called in
const file = process.argv[2]
  ? path.resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[2])
  : path.join(root, 'assets', 'map', 'office.json')

let text
try {
  text = fs.readFileSync(file, 'utf8')
} catch (error) {
  console.error(`Cannot read ${file}: ${error.message}`)
  process.exit(1)
}

const result = parseMap(text)
if (!result.ok) {
  console.error(`${file} is not a valid VirtualOffice map:\n${describeIssues(result.errors, 50)}`)
  process.exit(1)
}
const { map } = result
const info = officeMapInfo(map)
const chairs = map.placements.filter((p) => p.asset === 'chair').length
console.log(
  `${file} is a valid map: "${map.name}", ${map.width} x ${map.height} tiles, ` +
    `${map.placements.length} placements (${chairs} chairs, ${info.computerIds.length} computers), ` +
    `${map.zones.length} media zones, ${map.labels.length} labels`
)
