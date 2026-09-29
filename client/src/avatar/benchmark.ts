import Phaser from 'phaser'
import { AVATAR_OPTIONS, type AvatarDescription } from '../../../types/Avatar'
import { avatarTextureKey, ensureAvatarTexture } from './composeAvatar'

function* allAvatars(): Generator<AvatarDescription> {
  const { body, hair, hairColor, top, bottom } = AVATAR_OPTIONS
  for (const b of body)
    for (const h of hair)
      for (const c of hairColor)
        for (const t of top)
          for (const o of bottom)
            yield { body: b.id, hair: h.id, hairColor: c.id, top: t.id, bottom: o.id }
}

function gpuName(gl?: WebGLRenderingContext) {
  if (!gl) return 'canvas'
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
}

/**
 * Dev tool (window.avatarBenchmark(n) in the console): composes n avatars that don't exist yet
 * and waits for the GPU after each one (gl.finish), so the times include the actual drawing.
 */
export function benchmarkAvatars(scene: Phaser.Scene, count = 50) {
  const gl = (scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl as
    WebGLRenderingContext | undefined
  const times: number[] = []
  for (const avatar of allAvatars()) {
    if (times.length >= count) break
    if (scene.textures.exists(avatarTextureKey(avatar))) continue
    const start = performance.now()
    ensureAvatarTexture(scene, avatar)
    gl?.finish()
    times.push(performance.now() - start)
  }
  const sorted = [...times].sort((a, b) => a - b)
  const result = {
    count: sorted.length,
    averageMs: sorted.reduce((sum, time) => sum + time, 0) / sorted.length,
    medianMs: sorted[Math.floor(sorted.length / 2)],
    maxMs: sorted[sorted.length - 1],
    firstMs: times[0],
    renderer: gpuName(gl),
  }
  console.table(result)
  return result
}
