import { useEffect } from 'react'
import { useGame } from '../state/game'
import { playEmote } from '../game/actions'
import MediaControls, { Status } from './MediaControls'
import VideoGrid, { SelfPreview } from './VideoGrid'
import SettingsModal from './SettingsModal'

export default function Hud() {
  const prompt = useGame((s) => s.prompt)
  const roomName = useGame((s) => s.roomName)
  const playerCount = useGame((s) => Object.keys(s.players).length + 1)
  const settingsOpen = useGame((s) => s.settingsOpen)

  // leaving the office while the dialog is open must not keep the keyboard blocked
  useEffect(() => () => useGame.getState().set({ settingsOpen: false }), [])

  return (
    <>
      <div className="hud-top">
        <span className="pill">
          🏢 {roomName || 'Büro'} · {playerCount} online
        </span>
        <button
          className="pill button"
          onClick={() => useGame.getState().set({ editorOpen: true })}
        >
          👕 Charakter
        </button>
        <button
          className="pill button"
          title="Einstellungen & Steuerung"
          aria-label="Einstellungen & Steuerung"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          onClick={() => useGame.getState().set({ settingsOpen: true })}
        >
          ⚙️
        </button>
        <Status />
      </div>
      {settingsOpen && <SettingsModal />}
      <div className="hud-right">
        <VideoGrid />
      </div>
      {prompt && <div className="prompt">{prompt}</div>}
      <div className="hud-self">
        <div className="self-controls">
          <MediaControls />
        </div>
        <SelfPreview />
        <div className="emotes">
          <button onClick={() => playEmote('wave')} title="Winken (1)">
            👋
          </button>
          <button onClick={() => playEmote('cheer')} title="Jubeln (2)">
            🎉
          </button>
          <button onClick={() => playEmote('hop')} title="Hüpfen (Leertaste)">
            ⤴️
          </button>
        </div>
      </div>
    </>
  )
}
