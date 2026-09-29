import { useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import Chibi from '../avatar/Chibi'
import { createMotion, type Motion, type MotionState } from '../avatar/motion'
import { PRESETS, PRESET_TEXTURES, type Avatar } from '../avatar/avatar'
import { Box, Cyl } from '../world/parts'
import PostFx from '../toon/PostFx'

// /?gallery: all presets and hair styles side by side in the game's camera angle, to
// compare the chibis with the 2D sprites (and to take screenshots for the PoC notes).

const EXTRA: Avatar[] = [
  {
    ...PRESETS.lucy,
    hair: 'bun',
    hairColor: '#9fb8f0',
    top: 'hoodie',
    topColor: '#ffe08a',
    skin: '#7a4c36',
  },
  {
    ...PRESETS.ash,
    hair: 'pigtails',
    hairColor: '#f4a6c0',
    top: 'tshirt',
    topColor: '#8fd3e8',
    bottom: 'skirt',
    bottomColor: '#c9a7f5',
  },
  {
    ...PRESETS.adam,
    hair: 'bob',
    hairColor: '#f2e6c9',
    top: 'sweater',
    topColor: '#b5e8a3',
    skin: '#c98d66',
  },
  {
    ...PRESETS.nancy,
    hair: 'spiky',
    hairColor: '#d9735b',
    top: 'hoodie',
    topColor: '#9fb2ff',
    bottom: 'pants',
    bottomColor: '#3f4652',
  },
]

function Posed({
  avatar,
  state,
  x,
  z,
}: {
  avatar: Avatar
  state: MotionState
  x: number
  z: number
}) {
  const [motion] = useState<Motion>(createMotion)
  useFrame(({ clock }) => {
    if (motion.state !== state) {
      motion.state = state
      motion.since = clock.elapsedTime
    }
    motion.speed = state === 'walk' ? 0.8 : 0
  })
  return (
    <group position={[x, 0, z]}>
      {state === 'sit' && (
        <group>
          <Box size={[0.48, 0.1, 0.46]} position={[0, 0.28, 0]} color="#c9d6ee" />
          <Box size={[0.46, 0.4, 0.09]} position={[0, 0.5, -0.22]} color="#c9d6ee" />
          <Cyl top={0.18} bottom={0.2} height={0.05} position={[0, 0.025, 0]} color="#9e98b0" />
        </group>
      )}
      <Chibi avatar={avatar} motion={motion} seed={x * 0.13 + z * 0.07} />
    </group>
  )
}

export default function Gallery() {
  const avatars = [...PRESET_TEXTURES.map((t) => PRESETS[t]), ...EXTRA]
  const states: MotionState[] = ['idle', 'walk', 'sit', 'idle', 'idle', 'walk', 'sit', 'idle']
  return (
    <div className="app">
      <Canvas flat dpr={[1, 2]}>
        <OrthographicCamera
          makeDefault
          position={[20, 19, 20]}
          zoom={120}
          near={-100}
          far={300}
          onUpdate={(c) => c.lookAt(0, 0, 0)}
        />
        <group position={[-3.2, 0, -1]}>
          <hemisphereLight args={['#fff4fb', '#cbb8e0', 1.4]} />
          <directionalLight position={[8, 14, 5]} intensity={1.6} color="#fff3e2" />
          <Box size={[9, 0.3, 4]} position={[3.2, -0.15, 1.2]} color="#efe4f3" radius={0.1} />
          {avatars.map((avatar, i) => (
            <Posed
              key={i}
              avatar={avatar}
              state={states[i]}
              x={(i % 4) * 1.6 + 0.8}
              z={Math.floor(i / 4) * 1.7 + 0.4}
            />
          ))}
        </group>
        <PostFx />
      </Canvas>
    </div>
  )
}
