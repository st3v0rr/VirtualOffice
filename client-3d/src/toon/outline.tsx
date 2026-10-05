import * as THREE from 'three'
import { OUTLINE_COLOR } from './materials'

// Inverted-hull outline: the same geometry again, drawn from the back and pushed out
// along the normals in view space, so the line has the same width on stretched
// spheres. One shared material for everything keeps it cheap; it also works for
// InstancedMesh (three adds the instancing defines to ShaderMaterials).
export function createOutlineMaterial(thickness: number, color = OUTLINE_COLOR) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      thickness: { value: thickness },
      color: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */ `
      uniform float thickness;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * local;
        mv.xyz += normalize(normalMatrix * n) * thickness;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      void main() {
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

export const outlineThin = createOutlineMaterial(0.016)
export const outlineFurniture = createOutlineMaterial(0.022)

type HullProps = { geometry: THREE.BufferGeometry; material?: THREE.Material }

// put inside a <mesh>: draws the outline of the parent with its transform
export function Hull({ geometry, material = outlineThin }: HullProps) {
  return <mesh geometry={geometry} material={material} raycast={() => null} />
}
