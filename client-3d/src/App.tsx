import { Canvas } from '@react-three/fiber'
import Scene from './world/Scene'
import Join from './ui/Join'
import AvatarEditor from './ui/AvatarEditor'
import Hud from './ui/Hud'
import Chat from './ui/Chat'
import Dialogs from './ui/Dialogs'
import { StatsProbe } from './ui/Stats'
import { useGame } from './state/game'
import { useSettings } from './state/settings'

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
        <StatsProbe visible={stats} />
      </Canvas>
      {!connected && <Join />}
      {connected && (
        <>
          <Hud />
          <Chat />
          <Dialogs />
        </>
      )}
      {editorOpen && <AvatarEditor />}
    </div>
  )
}
