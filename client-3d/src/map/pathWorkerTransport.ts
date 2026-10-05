// The production PathTransport: ships a path request to pathfinding.worker.ts and resolves
// with its result. Lazily creates a single worker, reused across requests.
import type { PathResult, PathTransport } from './pathRequestQueue'
import { getOffice, type OfficeData } from './office'
import { collisionSource } from './walk'

type Response = { id: number; path: PathResult }

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, (path: PathResult) => void>()
// the office the worker has, so it is only sent again when it changes
let sentOffice: OfficeData | null = null

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./pathfinding.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<Response>) => {
      const { id, path } = e.data
      pending.get(id)?.(path)
      pending.delete(id)
    }
    worker.onerror = () => {
      sentOffice = null
      for (const resolve of pending.values()) resolve(null)
      pending.clear()
    }
  }
  return worker
}

export const findPathInWorker: PathTransport = (x, z, tx, tz) =>
  new Promise((resolve) => {
    try {
      const id = nextId++
      pending.set(id, resolve)
      const office = getOffice()
      const source = office === sentOffice ? undefined : collisionSource(office)
      getWorker().postMessage({ id, x, z, tx, tz, source })
      sentOffice = office
    } catch {
      resolve(null) // no worker support: fail safe instead of freezing the main thread
    }
  })
