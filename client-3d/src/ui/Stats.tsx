import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'

declare global {
  interface Window {
    __perf?: { fps: number; frameMs: number; calls: number; triangles: number; players: number }
  }
}

// FPS, frame time and draw calls, measured over half a second. Also exposed as
// window.__perf so a headless browser can read it (see scripts/measure.mjs).
export function StatsProbe({ visible }: { visible: boolean }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const el = useRef<HTMLDivElement>(null)
  const acc = useRef({ frames: 0, time: 0 })

  useFrame((_, delta) => {
    const a = acc.current
    a.frames++
    a.time += delta
    if (a.time < 0.5) return
    const info = gl.info.render
    let players = 0
    scene.traverse((o) => {
      if (o.userData.chibi) players++
    })
    window.__perf = {
      fps: Math.round(a.frames / a.time),
      frameMs: Math.round((a.time / a.frames) * 1000 * 10) / 10,
      calls: info.calls,
      triangles: info.triangles,
      players,
    }
    a.frames = 0
    a.time = 0
    if (el.current) {
      const p = window.__perf
      el.current.textContent = `${p.fps} FPS · ${p.frameMs} ms · ${p.calls} draw calls · ${(p.triangles / 1000).toFixed(0)}k tris · ${p.players} chibis`
    }
  })

  if (!visible) return null
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }} zIndexRange={[30, 30]}>
      <div ref={el} className="stats" />
    </Html>
  )
}
