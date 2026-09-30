import { useState } from 'react'
import { useGame } from '../state/game'
import { useSettings, type PostFx } from '../state/settings'
import { playEmote } from '../game/actions'
import { network } from '../net/network'
import MediaControls from './MediaControls'
import VideoGrid from './VideoGrid'

function Settings({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const name = useGame((g) => g.name)
  const [newName, setNewName] = useState(name)
  return (
    <div className="panel settings">
      <h3>Einstellungen</h3>
      <label>
        <input
          type="checkbox"
          checked={s.outlines}
          onChange={(e) => s.set({ outlines: e.target.checked })}
        />{' '}
        Konturen (Inverted Hull)
      </label>
      <label>
        <input
          type="checkbox"
          checked={s.lowWalls}
          onChange={(e) => s.set({ lowWalls: e.target.checked })}
        />{' '}
        Vordere Wände absenken
      </label>
      <label>
        <input
          type="checkbox"
          checked={s.stats}
          onChange={(e) => s.set({ stats: e.target.checked })}
        />{' '}
        FPS-Anzeige
      </label>
      <label>
        Look:{' '}
        <select value={s.postFx} onChange={(e) => s.set({ postFx: e.target.value as PostFx })}>
          <option value="off">Klar (Standard)</option>
          <option value="pixel">Pixel-Look (Post-FX)</option>
          <option value="outline">Kanten-Post-FX</option>
        </select>
      </label>
      <label>
        Name:{' '}
        <input
          value={newName}
          maxLength={24}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' && newName.trim()) {
              useGame.getState().set({ name: newName.trim() })
              localStorage.setItem('skyoffice3d.name', newName.trim())
              network.sendName(newName.trim())
            }
          }}
        />
      </label>
      <button className="secondary" onClick={onClose}>
        Schließen
      </button>
    </div>
  )
}

export default function Hud() {
  const prompt = useGame((s) => s.prompt)
  const roomName = useGame((s) => s.roomName)
  const playerCount = useGame((s) => Object.keys(s.players).length + 1)
  const [settings, setSettings] = useState(false)
  const [help, setHelp] = useState(true)

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
        <button className="pill button" onClick={() => setSettings((v) => !v)}>
          ⚙️
        </button>
        <button className="pill button" onClick={() => setHelp((v) => !v)}>
          ❓
        </button>
        <MediaControls />
      </div>
      {settings && <Settings onClose={() => setSettings(false)} />}
      <div className="hud-right">
        {help && (
          <div className="panel help">
            <b>Steuerung</b>
            <div>WASD / Pfeile: laufen · Klick: hinlaufen</div>
            <div>E: hinsetzen / aufstehen · R: benutzen</div>
            <div>Leertaste: hüpfen · 1: winken · 2: jubeln</div>
            <div>Mausrad: zoomen · Enter: Chat</div>
          </div>
        )}
        <VideoGrid />
      </div>
      {prompt && <div className="prompt">{prompt}</div>}
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
    </>
  )
}
