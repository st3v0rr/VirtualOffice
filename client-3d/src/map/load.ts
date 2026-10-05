import type { VirtualOfficeMap } from '../../../types/map/format'
import { describeIssues, parseMap } from '../../../types/map/validate'
import { serverHttpUrl } from '../net/endpoint'
import { bundledOffice } from './office'

// The office map comes from the server (GET /map.json), so the client always draws the
// map the server checks positions and media zones against. Without a reachable server
// (e.g. only the client's dev server runs) the copy built into the client is used.

export type LoadedMap = { map: VirtualOfficeMap; source: 'server' | 'built-in' }

export const mapUrl = () => `${serverHttpUrl()}/map.json`

export async function loadOfficeMap(
  url = mapUrl(),
  { fetch: get = fetch, timeout = 5000 } = {}
): Promise<LoadedMap> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await get(url, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const result = parseMap(await response.text())
    if (!result.ok) throw new Error(`invalid map\n${describeIssues(result.errors)}`)
    return { map: result.map, source: 'server' }
  } catch (error) {
    console.warn(
      `The office map of the server (${url}) is not available, using the built-in one`,
      error
    )
    return { map: bundledOffice.map, source: 'built-in' }
  } finally {
    clearTimeout(timer)
  }
}
