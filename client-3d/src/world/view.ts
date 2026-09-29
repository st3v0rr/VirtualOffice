import * as THREE from 'three'

// The camera frustum of the current frame, updated once per frame by the Scene, so
// chibis outside the view can skip their animation (see Chibi).
export const view = {
  frustum: new THREE.Frustum(),
  matrix: new THREE.Matrix4(),
}

const sphere = new THREE.Sphere()

export function inView(object: THREE.Object3D, radius = 1.2) {
  sphere.center.setFromMatrixPosition(object.matrixWorld)
  sphere.center.y += 0.6
  sphere.radius = radius
  return view.frustum.intersectsSphere(sphere)
}

export function updateView(camera: THREE.Camera) {
  view.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  view.frustum.setFromProjectionMatrix(view.matrix)
}
