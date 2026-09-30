// in the open office, start listening to someone closer than NEAR and stop beyond FAR
// (the gap avoids flickering connections at the edge); distances in map pixels
export const NEAR_DISTANCE = 110
export const FAR_DISTANCE = 170

/**
 * Updates the set of players I listen to in the open office from the current distances
 * (by session id). Players without a distance (gone, or in another room) are dropped.
 * Returns whether the set changed.
 */
export function updateNearby(nearby: Set<string>, distances: Map<string, number>): boolean {
  let changed = false
  for (const [id, distance] of distances) {
    if (distance <= NEAR_DISTANCE && !nearby.has(id)) {
      nearby.add(id)
      changed = true
    } else if (distance > FAR_DISTANCE && nearby.has(id)) {
      nearby.delete(id)
      changed = true
    }
  }
  for (const id of nearby) {
    if (!distances.has(id)) {
      nearby.delete(id)
      changed = true
    }
  }
  return changed
}
