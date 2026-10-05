// Runs findPath off the main thread so a far or obstacle-heavy search can never block
// rendering or keyboard input in LocalPlayer's frame loop. The office comes with the first
// request (and again whenever it changes), so the worker doesn't bundle a map of its own.
import { createCollision, type Collision, type CollisionSource } from './collision'

type Request = {
  id: number
  x: number
  z: number
  tx: number
  tz: number
  source?: CollisionSource
}

const ctx = self as unknown as Worker
let collision: Collision | null = null

ctx.onmessage = (e: MessageEvent<Request>) => {
  const { id, x, z, tx, tz, source } = e.data
  if (source) collision = createCollision(source)
  const path = collision ? collision.findPath(x, z, tx, tz) : null
  ctx.postMessage({ id, path })
}
