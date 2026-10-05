import { useMemo } from 'react'
import { EffectComposer, Pixelation } from '@react-three/postprocessing'
import { Effect, EffectAttribute } from 'postprocessing'
import * as THREE from 'three'
import { useSettings } from '../state/settings'
import { OUTLINE_COLOR } from './materials'

// Optional screen-space looks, switchable in the settings:
// - "pixel": renders at a lower resolution with hard pixels, a nod to the 2D pixel art
// - "outline": outlines from depth jumps instead of the per-mesh inverted hulls

// Laplacian of the depth buffer: flat or evenly sloped surfaces give 0, edges between
// objects give a spike. The camera is orthographic, so the depth is linear.
const fragment = /* glsl */ `
  uniform vec3 edgeColor;
  uniform float threshold;
  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    float l = readDepth(uv - vec2(texelSize.x, 0.0));
    float r = readDepth(uv + vec2(texelSize.x, 0.0));
    float d = readDepth(uv - vec2(0.0, texelSize.y));
    float u = readDepth(uv + vec2(0.0, texelSize.y));
    float laplace = abs(l + r + d + u - 4.0 * depth);
    float edge = smoothstep(threshold, threshold * 2.5, laplace);
    outputColor = vec4(mix(inputColor.rgb, edgeColor, edge * 0.8), inputColor.a);
  }
`

class DepthEdgesEffect extends Effect {
  constructor(threshold: number) {
    super('DepthEdgesEffect', fragment, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['edgeColor', new THREE.Uniform(new THREE.Color(OUTLINE_COLOR))],
        ['threshold', new THREE.Uniform(threshold)],
      ]),
    })
  }
}

function DepthEdges({ threshold = 0.00018 }: { threshold?: number }) {
  const effect = useMemo(() => new DepthEdgesEffect(threshold), [threshold])
  return <primitive object={effect} dispose={null} />
}

export default function PostFx() {
  const postFx = useSettings((s) => s.postFx)
  if (postFx === 'off') return null
  return (
    <EffectComposer multisampling={0}>
      {postFx === 'pixel' ? (
        <>
          <DepthEdges threshold={0.0006} />
          <Pixelation granularity={4} />
        </>
      ) : (
        <DepthEdges />
      )}
    </EffectComposer>
  )
}
