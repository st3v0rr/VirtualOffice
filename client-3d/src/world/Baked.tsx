import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { gradientMap } from '../toon/materials'
import { outlineFurniture } from '../toon/outline'

// Bakes static scenery (walls, furniture) into three meshes: toon-shaded, unlit and
// outlines, with the colours as vertex colours. The React components stay the way to
// describe the furniture; after they mounted, their hundreds of meshes are merged and
// taken out of rendering and matrix updates. Remount (change the key) to re-bake.

const TOON = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap })
const FLAT = new THREE.MeshBasicMaterial({ vertexColors: true })

function mergeMeshes(meshes: THREE.Mesh[], withColor: boolean) {
  if (!meshes.length) return null
  const color = new THREE.Color()
  let geometries = meshes.map((mesh) => {
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
    for (const name of Object.keys(g.attributes))
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    if (withColor) {
      color.copy((mesh.material as THREE.MeshToonMaterial).color)
      const count = g.getAttribute('position').count
      const colors = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3)
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    return g
  })
  // merging needs all geometries indexed or none
  if (geometries.some((g) => !g.index))
    geometries = geometries.map((g) => (g.index ? g.toNonIndexed() : g))
  const merged = mergeGeometries(geometries)
  merged.computeBoundingSphere()
  return merged
}

export default function Baked({ children }: { children: ReactNode }) {
  const source = useRef<THREE.Group>(null)
  const output = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    const src = source.current
    const out = output.current
    if (!src || !out) return
    src.updateWorldMatrix(true, true)
    const toon: THREE.Mesh[] = []
    const flat: THREE.Mesh[] = []
    const hull: THREE.Mesh[] = []
    src.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || (mesh as unknown as THREE.InstancedMesh).isInstancedMesh) return
      if (mesh.material === outlineFurniture) hull.push(mesh)
      else if (mesh.material instanceof THREE.MeshToonMaterial) toon.push(mesh)
      else if (mesh.material instanceof THREE.MeshBasicMaterial) flat.push(mesh)
    })
    // world matrices include the parent of `src`, so undo it for the output group
    const toLocal = out.matrixWorld.clone().invert()
    const meshes = [
      [mergeMeshes(toon, true), TOON],
      [mergeMeshes(flat, true), FLAT],
      [mergeMeshes(hull, false), outlineFurniture],
    ] as const
    const created: THREE.Mesh[] = []
    for (const [geometry, material] of meshes) {
      if (!geometry) continue
      geometry.applyMatrix4(toLocal)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.matrixAutoUpdate = false
      mesh.raycast = () => {}
      out.add(mesh)
      created.push(mesh)
    }
    // the originals are neither drawn nor updated any more
    src.visible = false
    src.matrixWorldAutoUpdate = false
    return () => {
      for (const mesh of created) {
        out.remove(mesh)
        mesh.geometry.dispose()
      }
      src.visible = true
      src.matrixWorldAutoUpdate = true
    }
  }, [])

  return (
    <>
      <group ref={source}>{children}</group>
      <group ref={output} />
    </>
  )
}
