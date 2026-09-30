// Converts the Tiled map of the office into the data the 3D diorama needs.
//
//   npm run extract-map -w client-3d
//
// Input:  assets/map/map.json (+ the tileset PNGs it references, assets/map/tilesets/)
// Output: client-3d/src/map/office.generated.json
//
// The Tiled map stays the single source of truth for the client and the server:
// - walkability/collision is taken from the rules of the original Phaser client
//   (tiles with a `collides` property, object layers with `collides` or the legacy
//   *OnCollide/Basement layers, the vending machine)
// - every decoration object is grouped with its neighbours into a "component" with a
//   bounding box and the average colour of its pixels, which the 3D client turns into a
//   toon prefab (see src/map/furniture.ts) or, as fallback, a rounded box
// - floor and wall colours are the averaged pixel colours of their tiles
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import * as prettier from 'prettier'
import { extractOffice } from './lib/extract.mjs'

const root = path.resolve(import.meta.dirname, '..', '..')
const mapFile = path.join(root, 'assets', 'map', 'map.json')
const outFile = path.join(root, 'client-3d', 'src', 'map', 'office.generated.json')

const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
const out = extractOffice(map, (tileset) => {
  const file = path.join(path.dirname(mapFile), tileset.image)
  if (!fs.existsSync(file)) throw new Error(`Tileset image for ${tileset.name} not found: ${file}`)
  return PNG.sync.read(fs.readFileSync(file))
})

fs.mkdirSync(path.dirname(outFile), { recursive: true })
// formatted like the rest of the repo, so a new extraction gives a readable diff
const options = await prettier.resolveConfig(outFile)
fs.writeFileSync(
  outFile,
  await prettier.format(JSON.stringify(out), { ...options, filepath: outFile })
)
console.log(
  `wrote ${path.relative(root, outFile)}: ${out.rows.join('').split('f').length - 1} floor tiles, ` +
    `${out.blockers.length} blockers, ${out.components.length} components, ${out.chairs.length} chairs`
)
