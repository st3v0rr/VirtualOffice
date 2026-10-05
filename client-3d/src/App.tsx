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
import MediaSetup from './ui/MediaSetup'
import { useGame } from './state/game'
import { useSettings } from './state/settings'

export default function App() {
  const connected = useGame((s) => s.connection === 'connected')
  const editorOpen = useGame((s) => s.editorOpen)
  const mediaSetupOpen = useGame((s) => s.mediaSetupOpen)
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
          {mediaSetupOpen && <MediaSetup />}
        </>
      )}
      {editorOpen && <AvatarEditor />}
    </div>
  )
}
