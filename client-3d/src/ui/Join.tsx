import { useEffect, useState } from 'react'
import { useGame } from '../state/game'
import { network, type RoomTarget } from '../net/network'
import { office } from '../map/office'
import { toAnim } from '../net/players'

// name, character and room, then join (like the login and room selection of the 2D client)
export default function Join() {
  const game = useGame()
  const [name, setName] = useState(game.name)
  // 'public', a room id, or 'new'
  const [choice, setChoice] = useState('public')
  const [password, setPassword] = useState('')
  const [newRoom, setNewRoom] = useState({ name: '', description: '', password: '' })
  const connecting = game.connection === 'connecting'

  useEffect(() => {
    network.joinLobby()
  }, [])

  const selected = game.rooms.find((r) => r.roomId === choice)
  const target: RoomTarget =
    choice === 'new'
      ? { kind: 'create', ...newRoom }
      : selected
        ? { kind: 'custom', roomId: selected.roomId, password }
        : { kind: 'public' }
  const ready =
    !!name.trim() &&
    !(choice === 'new' && !newRoom.name.trim()) &&
    !(selected?.hasPassword && !password)

  const join = async () => {
    const trimmed = name.trim()
    if (!ready) return
    localStorage.setItem('skyoffice3d.name', trimmed)
    game.set({ name: trimmed })
    await network.join(
      trimmed,
      game.avatar,
      { x: office.spawn.x, y: office.spawn.y, anim: toAnim(game.avatar.texture, 'idle', 0) },
      target
    )
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
      <div className="rooms">
        <label className={choice === 'public' ? 'active' : ''}>
          <input type="radio" checked={choice === 'public'} onChange={() => setChoice('public')} />
          🏢 Öffentliches Büro
        </label>
        {game.rooms.map((room) => (
          <label
            key={room.roomId}
            className={choice === room.roomId ? 'active' : ''}
            title={room.description}
          >
            <input
              type="radio"
              checked={choice === room.roomId}
              onChange={() => setChoice(room.roomId)}
            />
            {room.hasPassword ? '🔒' : '🚪'} {room.name}{' '}
            <span className="muted">· {room.clients}</span>
          </label>
        ))}
        <label className={choice === 'new' ? 'active' : ''}>
          <input type="radio" checked={choice === 'new'} onChange={() => setChoice('new')} />✨
          Eigenen Raum erstellen
        </label>
      </div>
      {selected?.hasPassword && (
        <input
          type="password"
          value={password}
          placeholder="Passwort"
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
      {choice === 'new' && (
        <div className="new-room">
          <input
            value={newRoom.name}
            maxLength={40}
            placeholder="Name des Raums"
            onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
          />
          <input
            value={newRoom.description}
            maxLength={80}
            placeholder="Beschreibung (optional)"
            onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
          />
          <input
            type="password"
            value={newRoom.password}
            placeholder="Passwort (optional)"
            onChange={(e) => setNewRoom({ ...newRoom, password: e.target.value })}
          />
        </div>
      )}
      <div className="join-buttons">
        <button className="secondary" onClick={() => game.set({ editorOpen: true })}>
          {game.hasSavedAvatar ? '✏️ Charakter ändern' : '✨ Charakter gestalten'}
        </button>
        <button className="primary" disabled={!ready || connecting} onClick={join}>
          {connecting ? 'Verbinde …' : 'Beitreten'}
        </button>
      </div>
      {game.connection === 'error' && <p className="error">{game.connectionError}</p>}
    </div>
  )
}
