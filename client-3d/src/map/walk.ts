import { createCollision, type Collision, type CollisionSource } from './collision'
import { getOffice, type OfficeData } from './office'

// Collision of an office, built once per office. The functions below are for the office
// the game shows (see office.ts).

const cache = new WeakMap<OfficeData, Collision>()

export function collisionOf(office: OfficeData = getOffice()) {
  let collision = cache.get(office)
  if (!collision) {
    collision = createCollision(office)
    cache.set(office, collision)
  }
  return collision
}

// the part of an office the path worker needs
export const collisionSource = (office: OfficeData = getOffice()): CollisionSource => ({
  width: office.width,
  height: office.height,
  rows: office.rows,
  blockers: office.blockers,
})

export const isFree = (x: number, z: number) => collisionOf().isFree(x, z)

export const move = (x: number, z: number, dx: number, dz: number) =>
  collisionOf().move(x, z, dx, dz)

export const findPath = (x: number, z: number, tx: number, tz: number) =>
  collisionOf().findPath(x, z, tx, tz)
