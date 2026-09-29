import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Avatar } from './avatar'

// The parts of a chibi as data, merged per body segment into one geometry with vertex
// colours. A chibi is then ~15 draw calls instead of ~50 (one per part plus outline),
// which matters with 40 people in the conference room. Players with the same avatar
// share the merged geometries.

export const SEGMENTS = ['head', 'eyes', 'hips', 'armL', 'armR', 'legL', 'legR'] as const
export type Segment = (typeof SEGMENTS)[number]

// pivots of the animated segments, relative to the bouncing body (see Chibi)
export const PIVOTS = {
  legL: [0.085, 0.2, 0],
  legR: [-0.085, 0.2, 0],
  hips: [0, 0.2, 0],
  // relative to the hips
  armL: [0.175, 0.25, 0],
  armR: [-0.175, 0.25, 0],
  head: [0, 0.31, 0],
  // relative to the head: its centre, the eyes blink around it
  eyes: [0, 0.27, 0],
} as const

export type MergedSegment = {
  // shaded parts (toon), unlit parts (eyes, mouth, blush) and the outlined parts
  toon?: THREE.BufferGeometry
  flat?: THREE.BufferGeometry
  hull?: THREE.BufferGeometry
}

// ---------- shared primitives ----------

const sphere = new THREE.SphereGeometry(1, 18, 12)
const sphereLow = new THREE.SphereGeometry(1, 10, 7)
const legGeometry = new THREE.CapsuleGeometry(0.068, 0.07, 4, 10)
const armGeometry = new THREE.CapsuleGeometry(0.05, 0.11, 4, 10)
const skirtGeometry = new THREE.CylinderGeometry(0.17, 0.25, 0.17, 18)
const hairCapGeometry = new THREE.SphereGeometry(0.33, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56)
// longer hair around the sides and the back, open at the front for the face
// (phi = PI / 2 points to +z, where the face is)
const BOB_GAP = Math.PI * 0.6
const bobGeometry = new THREE.SphereGeometry(
  0.345,
  22,
  14,
  Math.PI / 2 + BOB_GAP / 2,
  Math.PI * 2 - BOB_GAP,
  0,
  Math.PI * 0.66
)
const spikeGeometry = new THREE.ConeGeometry(0.075, 0.2, 8)
const mouthGeometry = new THREE.TorusGeometry(0.034, 0.01, 6, 14, Math.PI)
const hoodGeometry = new THREE.TorusGeometry(0.17, 0.065, 8, 20)
const collarGeometry = new THREE.TorusGeometry(0.13, 0.03, 6, 20)

const EYE_COLOR = '#2e2433'
const SHOE_COLOR = '#5a4a5e'
const ACCENT = '#fff6ea'
const BLUSH = '#ff8fa6'

// ---------- the parts ----------

type Vec3 = readonly [number, number, number]
type Part = {
  seg: Segment
  geometry: THREE.BufferGeometry
  color: string
  matrix: THREE.Matrix4
  outline: boolean
  flat?: boolean
}

const euler = new THREE.Euler()
const quaternion = new THREE.Quaternion()
function matrix(position: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: number | Vec3 = 1) {
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale
  quaternion.setFromEuler(euler.set(rotation[0], rotation[1], rotation[2]))
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    quaternion,
    new THREE.Vector3(s[0], s[1], s[2])
  )
}

function buildParts(a: Avatar): Part[] {
  const parts: Part[] = []
  const add = (
    seg: Segment,
    geometry: THREE.BufferGeometry,
    color: string,
    m: THREE.Matrix4,
    outline = true,
    flat = false
  ) => parts.push({ seg, geometry, color, matrix: m, outline, flat })

  // legs: trousers or bare legs, and shoes
  const legColor = a.bottom === 'pants' ? a.bottomColor : a.skin
  for (const seg of ['legL', 'legR'] as const) {
    add(seg, legGeometry, legColor, matrix([0, -0.09, 0]))
    add(seg, sphereLow, SHOE_COLOR, matrix([0, -0.18, 0.025], undefined, [0.078, 0.055, 0.105]))
  }

  // hips: bottom, torso and what belongs to the top
  if (a.bottom === 'skirt') add('hips', skirtGeometry, a.bottomColor, matrix([0, 0.02, 0]))
  else add('hips', sphere, a.bottomColor, matrix([0, 0.04, 0], undefined, [0.19, 0.1, 0.16]))
  if (a.bottom === 'shorts')
    for (const side of [1, -1])
      add(
        'hips',
        sphereLow,
        a.bottomColor,
        matrix([side * 0.085, -0.02, 0], undefined, 0.085),
        false
      )
  add('hips', sphere, a.topColor, matrix([0, 0.15, 0], undefined, [0.185, 0.19, 0.155]))
  if (a.top === 'hoodie') {
    add('hips', hoodGeometry, a.topColor, matrix([0, 0.29, -0.09], [1.2, 0, 0]))
    add(
      'hips',
      sphereLow,
      a.topColor,
      matrix([0, 0.09, 0.135], undefined, [0.1, 0.05, 0.03]),
      false
    )
    for (const side of [1, -1])
      add(
        'hips',
        sphereLow,
        ACCENT,
        matrix([side * 0.045, 0.22, 0.14], undefined, [0.012, 0.045, 0.012]),
        false
      )
  }
  if (a.top === 'sweater')
    add('hips', collarGeometry, ACCENT, matrix([0, 0.3, 0], [Math.PI / 2, 0, 0]), false)

  // arms: sleeves, arms and hands
  const armColor = a.top === 'tshirt' ? a.skin : a.topColor
  for (const seg of ['armL', 'armR'] as const) {
    if (a.top === 'tshirt') add(seg, sphereLow, a.topColor, matrix([0, -0.03, 0], undefined, 0.068))
    add(seg, armGeometry, armColor, matrix([0, -0.1, 0]))
    add(seg, sphereLow, a.skin, matrix([0, -0.19, 0], undefined, 0.058))
  }

  // the big head, around its centre
  const c = PIVOTS.eyes
  const head = (m: THREE.Matrix4) =>
    new THREE.Matrix4().makeTranslation(c[0], c[1], c[2]).multiply(m)
  add('head', sphere, a.skin, head(matrix(undefined, undefined, [0.312, 0.285, 0.3])))
  for (const side of [1, -1]) {
    add(
      'head',
      sphereLow,
      a.skin,
      head(matrix([side * 0.3, -0.02, 0], undefined, [0.05, 0.065, 0.045])),
      false
    )
    // blush, mixed into the skin colour instead of being transparent
    const blush = `#${new THREE.Color(a.skin).lerp(new THREE.Color(BLUSH), 0.6).getHexString()}`
    add(
      'head',
      sphereLow,
      blush,
      head(matrix([side * 0.19, -0.085, 0.225], [0, side * 0.7, 0], [0.055, 0.03, 0.02])),
      false,
      true
    )
  }
  add(
    'head',
    mouthGeometry,
    '#7a3b4a',
    head(matrix([0, -0.1, 0.285], [0.25, 0, Math.PI])),
    false,
    true
  )

  // hair
  const hair = (
    geometry: THREE.BufferGeometry,
    m: THREE.Matrix4,
    outline = true,
    color = a.hairColor
  ) => add('head', geometry, color, head(m), outline)
  const cap = () => hair(hairCapGeometry, matrix(undefined, [-0.42, 0, 0]))
  const bob = () => hair(bobGeometry, matrix(undefined, [-0.1, 0, 0]))
  // a fringe of little bumps over the forehead
  const bangs = () => {
    for (const x of [-0.15, -0.05, 0.05, 0.15])
      hair(
        sphereLow,
        matrix(
          [x, 0.17 - Math.abs(x) * 0.25, 0.235 - Math.abs(x) * 0.25],
          undefined,
          [0.085, 0.07, 0.06]
        ),
        false
      )
  }
  switch (a.hair) {
    case 'bob':
      cap()
      bob()
      bangs()
      break
    case 'spiky':
      cap()
      for (const [x, y, z, rx, rz] of [
        [0, 0.3, 0.02, 0, 0],
        [0.13, 0.26, 0.05, -0.2, -0.55],
        [-0.13, 0.26, 0.05, 0.2, 0.55],
        [0.06, 0.24, -0.16, -0.7, -0.25],
        [-0.08, 0.24, -0.16, -0.7, 0.3],
        [0, 0.22, 0.2, 0.7, 0],
      ])
        hair(spikeGeometry, matrix([x, y, z], [rx, 0, rz]))
      bangs()
      break
    case 'pigtails':
      cap()
      bob()
      bangs()
      for (const side of [1, -1]) {
        hair(sphere, matrix([side * 0.37, -0.04, -0.06], undefined, [0.1, 0.13, 0.1]))
        hair(sphereLow, matrix([side * 0.3, 0.07, -0.06], undefined, 0.045), false, '#ff8fb1')
      }
      break
    case 'bun':
      cap()
      bangs()
      hair(sphere, matrix([0, 0.3, -0.1], undefined, 0.13))
      break
  }

  // eyes, around the centre of the head so they can blink; a light rim keeps them
  // readable on every skin tone
  for (const side of [1, -1]) {
    const eye = matrix([side * 0.112, -0.015, 0.268], [0, side * 0.38, 0])
    const at = (m: THREE.Matrix4) => eye.clone().multiply(m)
    add(
      'eyes',
      sphereLow,
      '#fffaf5',
      at(matrix([0, 0, -0.004], undefined, [0.062, 0.084, 0.03])),
      false,
      true
    )
    add(
      'eyes',
      sphereLow,
      EYE_COLOR,
      at(matrix(undefined, undefined, [0.052, 0.074, 0.035])),
      false,
      true
    )
    add(
      'eyes',
      sphereLow,
      '#ffffff',
      at(matrix([0.018, 0.028, 0.028], undefined, 0.02)),
      false,
      true
    )
  }
  return parts
}

// ---------- merging ----------

function merge(parts: Part[]) {
  if (!parts.length) return undefined
  const color = new THREE.Color()
  const geometries = parts.map((part) => {
    const g = part.geometry.clone().applyMatrix4(part.matrix)
    // the same attributes everywhere, so they can be merged
    g.deleteAttribute('uv')
    color.set(part.color)
    const count = g.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  })
  const merged = mergeGeometries(geometries)
  geometries.forEach((g) => g.dispose())
  merged.computeBoundingSphere()
  return merged
}

const cache = new Map<string, Record<Segment, MergedSegment>>()
// the cache holds a few hundred avatars at most, then starts over
const CACHE_LIMIT = 300

export function chibiGeometry(avatar: Avatar): Record<Segment, MergedSegment> {
  const key = JSON.stringify(avatar)
  let result = cache.get(key)
  if (result) return result
  const parts = buildParts(avatar)
  result = {} as Record<Segment, MergedSegment>
  for (const seg of SEGMENTS) {
    const own = parts.filter((p) => p.seg === seg)
    result[seg] = {
      toon: merge(own.filter((p) => !p.flat)),
      flat: merge(own.filter((p) => p.flat)),
      hull: merge(own.filter((p) => p.outline)),
    }
  }
  // (not disposed: chibis on screen may still use them)
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, result)
  return result
}
