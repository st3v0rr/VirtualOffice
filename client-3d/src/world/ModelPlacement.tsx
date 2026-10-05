import { Component, Suspense, use, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { rotationToRadians } from '../../../types/map/format'
import { modelUrl } from '../../../types/map/validate'
import { wallFaceZ, type FurnitureData } from '../map/office'
import { Box } from './parts'
import { isLocalModelUrl } from './modelUrl'
import { useOffice } from './officeContext'

// A glTF/GLB model the map registered in its `assets`, loaded from models/ of the client
// (client-3d/public/models). While it loads, and if it can't be loaded, a plain box shows
// the footprint instead.

const BASE = import.meta.env.BASE_URL
const manager = new THREE.LoadingManager()
// a model can't make the browser fetch anything outside models/
manager.setURLModifier((url) => (isLocalModelUrl(url, location.href, BASE) ? url : 'data:,'))

const models = new Map<string, Promise<GLTF>>()
function loadModel(url: string) {
  let model = models.get(url)
  if (!model) {
    model = new GLTFLoader(manager).loadAsync(url)
    models.set(url, model)
  }
  return model
}

class Fallback extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('A model of the map could not be loaded', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function Model({ url, scale }: { url: string; scale: number }) {
  const gltf = use(loadModel(url))
  // every placement needs its own copy of the scene graph
  const scene = useMemo(() => gltf.scene.clone(true), [gltf])
  return <primitive object={scene} scale={scale} />
}

export default function ModelPlacement({ item }: { item: FurnitureData }) {
  const office = useOffice()
  const source = item.asset.model!
  const onWall = item.asset.mount === 'wall'
  const x = item.x + item.w / 2
  const z = onWall ? wallFaceZ(office, item) + 0.05 : item.y + item.h / 2
  const placeholder = (
    <Box
      size={[item.w - 0.1, 0.5, Math.max(item.h - 0.1, 0.1)]}
      position={[0, 0.25, 0]}
      color="#e6e1ee"
    />
  )
  return (
    <group position={[x, onWall ? 1 : 0, z]} rotation={[0, rotationToRadians(item.rotation), 0]}>
      <Fallback fallback={placeholder}>
        <Suspense fallback={placeholder}>
          <Model url={modelUrl(source.src, BASE)} scale={source.scale ?? 1} />
        </Suspense>
      </Fallback>
    </group>
  )
}
