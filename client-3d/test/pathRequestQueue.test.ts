import { describe, expect, it } from 'vitest'
import { createPathQueue, type PathResult, type PathTransport } from '../src/map/pathRequestQueue'

// a transport whose requests resolve only when the test tells them to, and in whatever
// order the test chooses, so we can simulate a slow or out-of-order worker reply
function fakeTransport() {
  const resolvers: ((path: PathResult) => void)[] = []
  const calls: { x: number; z: number; tx: number; tz: number }[] = []
  const transport: PathTransport = (x, z, tx, tz) => {
    calls.push({ x, z, tx, tz })
    return new Promise((resolve) => resolvers.push(resolve))
  }
  return { transport, resolvers, calls }
}

describe('createPathQueue', () => {
  it('delivers a single resolved request', async () => {
    const { transport, resolvers } = fakeTransport()
    const queue = createPathQueue(transport)
    const results: PathResult[] = []
    queue.request(0, 0, 1, 1, (path) => results.push(path))
    resolvers[0]([{ x: 1, z: 1 }])
    await Promise.resolve()
    expect(results).toEqual([[{ x: 1, z: 1 }]])
  })

  it('a newer request supersedes an older one even if the old one resolves last', async () => {
    const { transport, resolvers } = fakeTransport()
    const queue = createPathQueue(transport)
    const results: PathResult[] = []
    queue.request(0, 0, 1, 1, (path) => results.push(path))
    queue.request(0, 0, 2, 2, (path) => results.push(path))
    // the second (newer) request resolves first, the first (stale) resolves after
    resolvers[1]([{ x: 2, z: 2 }])
    resolvers[0]([{ x: 1, z: 1 }])
    await Promise.resolve()
    expect(results).toEqual([[{ x: 2, z: 2 }]])
  })

  it('cancel suppresses a result that arrives afterwards', async () => {
    const { transport, resolvers } = fakeTransport()
    const queue = createPathQueue(transport)
    const results: PathResult[] = []
    queue.request(0, 0, 1, 1, (path) => results.push(path))
    queue.cancel()
    resolvers[0]([{ x: 1, z: 1 }])
    await Promise.resolve()
    expect(results).toEqual([])
  })

  it('fails safe (null) when the transport rejects', async () => {
    const transport: PathTransport = () => Promise.reject(new Error('worker crashed'))
    const queue = createPathQueue(transport)
    const results: PathResult[] = []
    queue.request(0, 0, 1, 1, (path) => results.push(path))
    await Promise.resolve()
    await Promise.resolve()
    expect(results).toEqual([null])
  })

  it('a cancelled-then-new request still delivers the new one', async () => {
    const { transport, resolvers } = fakeTransport()
    const queue = createPathQueue(transport)
    const results: PathResult[] = []
    queue.request(0, 0, 1, 1, (path) => results.push(path))
    queue.cancel()
    queue.request(0, 0, 3, 3, (path) => results.push(path))
    resolvers[0]([{ x: 1, z: 1 }]) // stale, cancelled before this request started
    resolvers[1]([{ x: 3, z: 3 }])
    await Promise.resolve()
    expect(results).toEqual([[{ x: 3, z: 3 }]])
  })
})
