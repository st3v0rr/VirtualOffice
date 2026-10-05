import { useEffect } from 'react'
import { useGame } from '../state/game'
import { playEmote, toggleHand } from '../game/actions'
import { EMOTE_BUTTONS } from '../game/emotes'
import MediaControls, { Status } from './MediaControls'
import VideoGrid, { SelfPreview } from './VideoGrid'
import SettingsModal from './SettingsModal'

export default function Hud() {
  const prompt = useGame((s) => s.prompt)
  const roomName = useGame((s) => s.roomName)
  const playerCount = useGame((s) => Object.keys(s.players).length + 1)
  const settingsOpen = useGame((s) => s.settingsOpen)
  const handUp = useGame((s) => !!s.sessionId && !!s.handsUp[s.sessionId])

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
          {EMOTE_BUTTONS.map((b, i) => (
            <button
              key={b.emote}
              onClick={() => playEmote(b.emote)}
              title={`${b.label} (${i + 1})`}
              aria-label={b.label}
            >
              {b.icon}
            </button>
          ))}
          <button
            className={handUp ? 'active' : undefined}
            onClick={toggleHand}
            title={handUp ? 'Hand senken (5)' : 'Hand heben (5)'}
            aria-label="Hand heben"
            aria-pressed={handUp}
          >
            ✋
          </button>
        </div>
      </div>
    </>
  )
}
