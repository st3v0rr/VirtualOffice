import * as THREE from 'three'

// Everything in the office uses the same toon look: three soft light bands instead of
// smooth shading, so shapes read like painted toys. Materials are shared by colour,
// which keeps the number of shader programs and material switches low.

function createGradientMap() {
  // dark, mid and lit band; the dark band isn't very dark so shadows stay pastel
  const data = new Uint8Array([150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255])
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

export const gradientMap = createGradientMap()

const toonCache = new Map<string, THREE.MeshToonMaterial>()

export function toon(color: string) {
  let material = toonCache.get(color)
  if (!material) {
    material = new THREE.MeshToonMaterial({ color, gradientMap })
    toonCache.set(color, material)
  }
  return material
}

const flatCache = new Map<string, THREE.MeshBasicMaterial>()

// unlit, for eyes, screens and other things that shouldn't get shaded
export function flat(color: string, opacity = 1) {
  const key = `${color}/${opacity}`
  let material = flatCache.get(key)
  if (!material) {
    material = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity === 1,
    })
    flatCache.set(key, material)
  }
  return material
}

export const OUTLINE_COLOR = '#4a3f55'
