import * as THREE from 'three'

// Whether a chibi is inside the camera frustum, so chibis outside the view can skip
// their animation. The frustum is computed once per camera and frame (there are two
// canvases while the character editor is open).

const cache = new Map<THREE.Camera, { time: number; frustum: THREE.Frustum }>()
const matrix = new THREE.Matrix4()
const sphere = new THREE.Sphere()

export function inView(object: THREE.Object3D, camera: THREE.Camera, time: number, radius = 1.2) {
  let entry = cache.get(camera)
  if (!entry) {
    entry = { time: -1, frustum: new THREE.Frustum() }
    cache.set(camera, entry)
  }
  if (entry.time !== time) {
    entry.time = time
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    entry.frustum.setFromProjectionMatrix(matrix)
  }
  sphere.center.setFromMatrixPosition(object.matrixWorld)
  sphere.center.y += 0.6
  sphere.radius = radius
  return entry.frustum.intersectsSphere(sphere)
}
