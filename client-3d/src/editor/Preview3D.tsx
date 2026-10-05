import { useLayoutEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OfficeData } from '../map/compile'
import { OfficeContext } from '../world/officeContext'
import { Floor, Walls } from '../world/walls'
import Furniture, { Models } from '../world/furniture'
import { Chairs, Computers, VendingMachines } from '../world/items'

// the whole office in view, framed like the overview before joining the office
function FitCamera({ width, height }: { width: number; height: number }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useLayoutEffect(() => {
    camera.zoom = Math.min(size.width / (width + 8), size.height / (height + 2))
    camera.updateProjectionMatrix()
  }, [camera, size, width, height])
  return null
}

// The map being edited in 3D, drawn by the same components as the office itself (only not
// baked, since it changes with every edit). Drag to turn, wheel to zoom.
export default function Preview3D({ office }: { office: OfficeData }) {
  const target: [number, number, number] = [office.width / 2, 0, office.height / 2]
  return (
    <div className="preview3d" data-testid="editor-preview">
      <Canvas
        flat
        orthographic
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{
          position: [target[0] + 20, 19, target[2] + 20],
          near: -100,
          far: 300,
        }}
      >
        <OfficeContext.Provider value={office}>
          <hemisphereLight args={['#fff4fb', '#cbb8e0', 1.4]} />
          <directionalLight position={[8, 14, 5]} intensity={1.6} color="#fff3e2" />
          <Floor />
          <Walls />
          <Furniture />
          <Models />
          <Chairs interactive={false} />
          <Computers interactive={false} />
          <VendingMachines interactive={false} />
        </OfficeContext.Provider>
        <FitCamera width={office.width} height={office.height} />
        <OrbitControls makeDefault target={target} enableDamping={false} />
      </Canvas>
    </div>
  )
}
