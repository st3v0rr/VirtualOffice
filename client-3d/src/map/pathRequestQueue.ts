// Click-to-walk requests go through here instead of calling findPath directly, so a slow
// search (far target, lots of obstacles) never runs on the frame that asked for it. The
// transport is injected so this stays pure and testable: a real caller plugs in a Worker,
// tests plug in a fake with controllable timing.

export type PathResult = { x: number; z: number }[] | null
export type PathTransport = (x: number, z: number, tx: number, tz: number) => Promise<PathResult>

export function createPathQueue(transport: PathTransport) {
  let token = 0

  // supersedes any route in flight, e.g. when keyboard input takes over
  function cancel() {
    token++
  }

  function request(
    x: number,
    z: number,
    tx: number,
    tz: number,
    onResult: (path: PathResult) => void
  ) {
    const mine = ++token
    transport(x, z, tx, tz).then(
      (path) => {
        if (mine !== token) return // a newer request or a cancel came in first
        onResult(path)
      },
      () => {
        if (mine !== token) return
        onResult(null) // transport failure: fail safe, don't walk anywhere
      }
    )
  }

  return { request, cancel }
}
