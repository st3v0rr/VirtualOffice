import type { Zone, ZoneType } from '../../../types/OfficeMap'
import { office, TILE } from './office'

// the zones of the Tiled map in map pixels, as the server reads them from the map
// (the extractor stores them in tiles)
export const zones: Zone[] = office.zones.map((zone) => ({
  id: zone.id,
  name: zone.name,
  type: zone.type as ZoneType,
  x: zone.x * TILE,
  y: zone.y * TILE,
  width: zone.w * TILE,
  height: zone.h * TILE,
}))
