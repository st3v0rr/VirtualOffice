import { Canvas } from '@react-three/fiber'
import Scene from './world/Scene'
import Join from './ui/Join'
import AvatarEditor from './ui/AvatarEditor'
import Hud from './ui/Hud'
import Chat from './ui/Chat'
import Dialogs from './ui/Dialogs'
import { StatsProbe } from './ui/Stats'
import PostFx from './toon/PostFx'
import { TagOverlay } from './player/TagLayer'
import Joystick from './ui/Joystick'
import { useGame } from './state/game'
import { useSettings } from './state/settings'

// touch screens get a joystick
const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export default function App() {
  const connected = useGame((s) => s.connection === 'connected')
  const editorOpen = useGame((s) => s.editorOpen)
  const stats = useSettings((s) => s.stats)

  return (
    <div className="app">
      <Canvas
        flat
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Scene />
        <StatsProbe />
        <PostFx />
      </Canvas>
      <TagOverlay />
      {stats && <div className="stats" id="stats" />}
      {!connected && <Join />}
      {connected && (
        <>
          <Hud />
          <Chat />
          <Dialogs />
          {touch && <Joystick />}
        </>
      )}
      {editorOpen && <AvatarEditor />}
    </div>
  )
}
