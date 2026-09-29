import { useState } from 'react'
import { useGame } from '../state/game'
import { network } from '../net/network'
import { office } from '../map/office'
import { toAnim } from '../net/players'

// name + avatar, then join the public office room
export default function Join() {
  const game = useGame()
  const [name, setName] = useState(game.name)
  const connecting = game.connection === 'connecting'

  const join = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    localStorage.setItem('skyoffice3d.name', trimmed)
    game.set({ name: trimmed })
    await network.join(trimmed, game.avatar, {
      x: office.spawn.x,
      y: office.spawn.y,
      anim: toAnim(game.avatar.texture, 'idle', 0),
    })
  }

  return (
    <div className="join">
      <h1>
        SkyOffice <span>3D</span>
      </h1>
      <p className="subtitle">Das Büro als Spielzeug-Diorama · Proof of Concept</p>
      <input
        autoFocus
        value={name}
        maxLength={24}
        placeholder="Dein Name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && join()}
      />
      <div className="join-buttons">
        <button className="secondary" onClick={() => game.set({ editorOpen: true })}>
          {game.hasSavedAvatar ? '✏️ Charakter ändern' : '✨ Charakter gestalten'}
        </button>
        <button className="primary" disabled={!name.trim() || connecting} onClick={join}>
          {connecting ? 'Verbinde …' : 'Beitreten'}
        </button>
      </div>
      {game.connection === 'error' && <p className="error">{game.connectionError}</p>}
    </div>
  )
}
