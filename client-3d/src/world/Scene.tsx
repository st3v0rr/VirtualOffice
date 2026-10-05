import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import { Floor, Walls } from './walls'
import Furniture from './furniture'
import Baked from './Baked'
import { useSettings } from '../state/settings'
import { Chairs, Computers, VendingMachines } from './items'
import { TagProjector } from '../player/TagLayer'
import LocalPlayer from '../player/LocalPlayer'
import RemotePlayer from '../player/RemotePlayer'
import { useGame } from '../state/game'
import { me } from '../net/players'
import { intent } from '../game/intent'
import { office } from '../map/office'
import { isTouchDevice } from '../device'
import { defaultZoom } from './cameraZoom'

// isometric: looking down from the south-east at ~35 degrees
const CAMERA_OFFSET = new THREE.Vector3(20, 19, 20)
const ZOOM_MIN = 22
const ZOOM_MAX = 140

function CameraRig({ follow }: { follow: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const zoom = useRef(defaultZoom(isTouchDevice))
  const target = useRef(new THREE.Vector3(office.width / 2, 0, office.height / 2))

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoom.current = THREE.MathUtils.clamp(
        zoom.current * Math.exp(-e.deltaY * 0.0012),
        ZOOM_MIN,
        ZOOM_MAX
      )
    }
    const el = gl.domElement
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [gl])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    // before joining: slowly show the whole office
    const overview = Math.min(size.width / 62, size.height / 40)
    const goal = follow
      ? new THREE.Vector3(me.x, 0.5, me.z)
      : new THREE.Vector3(office.width / 2 + 2, 0, office.height / 2)
    target.current.lerp(goal, 1 - Math.exp(-(follow ? 6 : 2) * dt))
    const z = follow ? zoom.current : overview
    camera.zoom += (z - camera.zoom) * (1 - Math.exp(-8 * dt))
    camera.position.copy(target.current).add(CAMERA_OFFSET)
    camera.lookAt(target.current)
    camera.updateProjectionMatrix()
  })
  return null
}

function Players() {
  const players = useGame((s) => s.players)
  return (
    <>
      {Object.entries(players).map(([id, p]) => (
        <RemotePlayer key={id} id={id} avatar={p.avatar} />
      ))}
    </>
  )
}

export default function Scene() {
  const connected = useGame((s) => s.connection === 'connected')
  const outlines = useSettings((s) => s.outlines)
  const lowWalls = useSettings((s) => s.lowWalls)
  return (
    <>
      <OrthographicCamera makeDefault position={[40, 30, 40]} zoom={20} near={-100} far={300} />
      <CameraRig follow={connected} />
      <hemisphereLight args={['#fff4fb', '#cbb8e0', 1.4]} />
      <directionalLight position={[8, 14, 5]} intensity={1.6} color="#fff3e2" />
      <Floor onPointerDown={(x, z) => connected && (intent.walkTo = { x, z })} />
      {/* walls and furniture don't move: merged into a few meshes once they mounted */}
      <Baked key={`${outlines}/${lowWalls}`}>
        <Walls />
        <Furniture />
      </Baked>
      <Chairs />
      <Computers />
      <VendingMachines />
      <TagProjector />
      {connected && (
        <>
          <LocalPlayer />
          <Players />
        </>
      )}
    </>
  )
}
