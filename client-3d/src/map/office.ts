import bundledMap from '../../../assets/map/office.json'
import { FEET_OFFSET_PX, TILE_SIZE } from '../../../types/map/format'
import { assertValidMap } from '../../../types/map/validate'
import { compileOffice, type ChairData, type OfficeData, type TileRect } from './compile'

export type {
  ChairData,
  FurnitureData,
  ItemData,
  LabelData,
  OfficeData,
  TileRect,
  ZoneData,
} from './compile'

// The office the game shows: the map the server serves (see load.ts), set before the app
// renders. Until then, and when the server can't be reached, the copy of
// assets/map/office.json built into the client.

export const bundledOffice = compileOffice(assertValidMap(bundledMap, 'built-in map'))
let current = bundledOffice

export const getOffice = () => current

export function setOffice(office: OfficeData) {
  current = office
}

export const TILE = TILE_SIZE
export { FEET_OFFSET_PX }

// Positions on the wire are the centre of the old 32x48 2D sprite; the feet (and the
// collision box) are FEET_OFFSET_PX below that. The 3D client stands on the feet.
export const toWorld = (px: number, py: number) => ({
  x: px / TILE,
  z: (py + FEET_OFFSET_PX) / TILE,
})
export const toMap = (x: number, z: number) => ({
  x: Math.round(x * TILE * 10) / 10,
  y: Math.round((z * TILE - FEET_OFFSET_PX) * 10) / 10,
})

export const tileAt = (office: OfficeData, tx: number, ty: number) => office.rows[ty]?.[tx] ?? '.'

const px = (tiles: number) => Math.round(tiles * TILE * 1000) / 1000

// where the old 2D client put a sitting player: the sprite centre of the chair, which is
// 16 px above the seat, shifted a little by the direction
const SIT_SHIFT: Record<ChairData['dir'], [number, number]> = {
  up: [0, 3],
  down: [0, 3],
  left: [0, -8],
  right: [0, -8],
}
export function chairSitPosition(chair: ChairData) {
  const [dx, dy] = SIT_SHIFT[chair.dir]
  return { x: px(chair.x) + dx, y: px(chair.z) - 16 + dy }
}

// the z of the wall face a wall-mounted thing belongs to: the first floor row below it
export function wallFaceZ(office: OfficeData, r: TileRect) {
  const tx = Math.floor(r.x + r.w / 2)
  let row = Math.ceil(r.y + r.h - 0.01)
  while (row < office.height && tileAt(office, tx, row) !== 'f') row++
  return row
}
