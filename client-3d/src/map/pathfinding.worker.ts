// Runs findPath off the main thread so a far or obstacle-heavy search can never block
// rendering or keyboard input in LocalPlayer's frame loop.
import { findPath } from './collision'

type Request = { id: number; x: number; z: number; tx: number; tz: number }

const ctx = self as unknown as Worker

ctx.onmessage = (e: MessageEvent<Request>) => {
  const { id, x, z, tx, tz } = e.data
  const path = findPath(x, z, tx, tz)
  ctx.postMessage({ id, path })
}
