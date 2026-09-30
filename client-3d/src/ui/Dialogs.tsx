import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useGame } from '../state/game'
import { useBoards, NOTE_COLOR_HEX, type Note } from '../state/boards'
import { network } from '../net/network'
import { ScreenShareSession } from '@skyoffice/media'
import { NOTE_COLORS, NOTE_LIMITS, type NoteColor } from '../../../types/Whiteboard'
import { DRINKS, type Drink } from '../avatar/motion'
import { drink } from '../game/actions'
import { computers, distanceTo } from '../game/interactables'
import { me as myPlayer } from '../net/players'

// Dialogs for the computers, whiteboards and the vending machine.

const NO_USERS: string[] = []
const close = () => useGame.getState().set({ dialog: null })

function Modal({ title, wide, children }: { title: string; wide?: boolean; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc while editing a note only ends the editing
      if (e.key === 'Escape' && !(document.activeElement instanceof HTMLTextAreaElement)) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div
        className={`modal dialog ${wide ? 'wide' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
        <button className="secondary close" onClick={close}>
          Schließen (Esc)
        </button>
      </div>
    </div>
  )
}

// ---------- computer: screen sharing through LiveKit ----------

function Video({ stream, muted }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} />
}

const SCREEN_SHARE_OPTIONS = {
  // fail fast without a LiveKit server instead of retrying for a long time
  connectOptions: { maxRetries: 0, websocketTimeout: 4000 },
  unavailableMessage: 'Bildschirmfreigabe nicht verfügbar (kein LiveKit-Server erreichbar).',
  noGrantMessage: 'An diesem Ort gibt es keine Medien.',
}
const NO_SESSION: ReturnType<ScreenShareSession['getSnapshot']> = { screens: [] }
const noSession = () => NO_SESSION
const noSubscribe = () => () => {}
// walking further away than this from a computer while its dialog is minimized leaves it
const COMPUTER_LEAVE_DISTANCE = 1.5

function ComputerDialog({ id }: { id: string }) {
  const users = useGame((s) => s.itemUsers[id]) ?? NO_USERS
  const players = useGame((s) => s.players)
  const me = useGame((s) => s.sessionId)
  const [session, setSession] = useState<ScreenShareSession>()
  const snapshot = useSyncExternalStore(
    session?.subscribe ?? noSubscribe,
    session?.getSnapshot ?? noSession
  )
  const [error, setError] = useState<string>()
  // minimized: the dialog is closed, but I stay at the computer and see the shared
  // screen on its monitor
  const [minimized, setMinimized] = useState(false)

  // the screen to show on the monitor: someone else's, or else my own
  const shown = snapshot.screens[0]?.stream ?? snapshot.myStream
  useEffect(() => {
    if (!shown) return
    const set = useGame.getState().set
    set({ screens: { ...useGame.getState().screens, [id]: shown } })
    return () => {
      const screens = { ...useGame.getState().screens }
      delete screens[id]
      set({ screens })
    }
  }, [id, shown])

  // leave the computer when walking away from it while minimized
  useEffect(() => {
    if (!minimized) return
    const computer = computers.find((c) => c.id === id)
    const timer = window.setInterval(() => {
      if (computer && distanceTo(computer, myPlayer.x, myPlayer.z) > COMPUTER_LEAVE_DISTANCE)
        close()
    }, 300)
    return () => window.clearInterval(timer)
  }, [id, minimized])

  useEffect(() => {
    network.connectToComputer(id)
    // a new session per mount: a closed session can't be opened again (React StrictMode)
    const session = new ScreenShareSession(network, id, SCREEN_SHARE_OPTIONS)
    // the server only hands out the computer's media token to its users
    const timer = window.setTimeout(() => {
      setSession(session)
      session.open()
    }, 150)
    return () => {
      window.clearTimeout(timer)
      session.close()
      network.disconnectFromComputer(id)
    }
  }, [id])

  const share = async () => {
    setError(undefined)
    try {
      await session?.startScreenShare()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const names = users.map((u) => (u === me ? 'Du' : (players[u]?.name ?? '…')))
  if (minimized)
    return (
      <div className="panel computer-mini">
        <span>
          💻{' '}
          {snapshot.myStream
            ? 'Du teilst deinen Bildschirm'
            : shown
              ? 'Freigabe auf dem Monitor'
              : 'Am Computer'}
        </span>
        <button onClick={() => setMinimized(false)}>Öffnen</button>
        <button className="secondary" onClick={close}>
          Verlassen
        </button>
      </div>
    )
  return (
    <Modal title="💻 Computer" wide>
      <p>Hier sitzen: {names.join(', ') || '—'}</p>
      <div className="toolbar">
        {snapshot.myStream ? (
          <button className="secondary" onClick={() => session?.stopScreenShare()}>
            Freigabe beenden
          </button>
        ) : (
          <button className="primary" onClick={share} disabled={!snapshot.connected}>
            🖥️ Bildschirm teilen
          </button>
        )}
        {!snapshot.connected && !snapshot.error && (
          <span className="muted">Verbinde mit LiveKit …</span>
        )}
        {snapshot.error && <span className="error">{snapshot.error}</span>}
        {error && <span className="error">{error}</span>}
        <button
          className="secondary"
          title="Dialog schließen, am Computer bleiben und die Freigabe auf dem Monitor sehen"
          onClick={() => setMinimized(true)}
        >
          📺 Auf dem Monitor zeigen
        </button>
      </div>
      <div className="screens">
        {snapshot.myStream && <Video stream={snapshot.myStream} muted />}
        {snapshot.screens.map((screen) => (
          <Video key={screen.id} stream={screen.stream} />
        ))}
        {!snapshot.myStream && !snapshot.screens.length && (
          <p className="muted">Noch teilt niemand seinen Bildschirm an diesem Computer.</p>
        )}
      </div>
    </Modal>
  )
}

// ---------- whiteboard: the sticky notes of the 2D client ----------

// a note while it is dragged, before the server has the new position
type Drag = { id: string; dx: number; dy: number; startX: number; startY: number }

function NoteCard({ note, scale, boardId }: { note: Note; scale: number; boardId: string }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.text)
  const [drag, setDrag] = useState<Drag | null>(null)
  const lastSent = useRef(0)

  const x = note.x + (drag?.dx ?? 0)
  const y = note.y + (drag?.dy ?? 0)

  const save = () => {
    setEditing(false)
    if (text !== note.text)
      network.updateNote({
        whiteboardId: boardId,
        noteId: note.id,
        changes: { text: text.slice(0, NOTE_LIMITS.maxTextLength) },
      })
  }

  return (
    <div
      className="note"
      style={{
        left: x * scale,
        top: y * scale,
        width: note.width * scale,
        height: note.height * scale,
        background: NOTE_COLOR_HEX[note.color] ?? NOTE_COLOR_HEX.yellow,
      }}
      onPointerDown={(e) => {
        if (editing) return
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag({ id: note.id, dx: 0, dy: 0, startX: e.clientX, startY: e.clientY })
      }}
      onPointerMove={(e) => {
        if (!drag) return
        const dx = (e.clientX - drag.startX) / scale
        const dy = (e.clientY - drag.startY) / scale
        setDrag({ ...drag, dx, dy })
        // like the 2D client: send while dragging, at most every 50 ms
        if (performance.now() - lastSent.current > 50) {
          lastSent.current = performance.now()
          network.updateNote({
            whiteboardId: boardId,
            noteId: note.id,
            changes: { x: note.x + dx, y: note.y + dy },
          })
        }
      }}
      onPointerUp={() => {
        if (!drag) return
        if (drag.dx || drag.dy)
          network.updateNote({
            whiteboardId: boardId,
            noteId: note.id,
            changes: { x: note.x + drag.dx, y: note.y + drag.dy },
          })
        setDrag(null)
      }}
      onDoubleClick={() => {
        setText(note.text)
        setEditing(true)
      }}
    >
      {editing ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') save()
          }}
        />
      ) : (
        <div className="text">
          {note.text || <span className="muted">Doppelklick zum Schreiben</span>}
        </div>
      )}
      <button
        className="delete"
        title="Löschen"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => network.deleteNote({ whiteboardId: boardId, noteId: note.id })}
      >
        ✕
      </button>
    </div>
  )
}

const BOARD_SCALE = 0.55

function WhiteboardDialog({ id }: { id: string }) {
  const board = useBoards((s) => s.boards[id])
  const [color, setColor] = useState<NoteColor>('yellow')
  const notes = Object.values(board?.notes ?? {})
  const arrows = Object.values(board?.arrows ?? {})

  useEffect(() => {
    network.connectToWhiteboard(id)
    return () => network.disconnectFromWhiteboard(id)
  }, [id])

  const add = () => {
    // in a grid next to the other notes, so the new one is visible without scrolling
    const x = 40 + (notes.length % 6) * 220
    const y = 40 + (Math.floor(notes.length / 6) % 4) * 220
    network.addNote({ whiteboardId: id, x, y, color })
  }

  const center = (note: Note) => ({
    x: (note.x + note.width / 2) * BOARD_SCALE,
    y: (note.y + note.height / 2) * BOARD_SCALE,
  })
  return (
    <Modal title="📝 Whiteboard" wide>
      <div className="toolbar">
        <button className="primary" onClick={add} disabled={notes.length >= NOTE_LIMITS.maxNotes}>
          + Zettel
        </button>
        {NOTE_COLORS.map((c) => (
          <button
            key={c}
            className={`swatch ${c === color ? 'active' : ''}`}
            style={{ background: NOTE_COLOR_HEX[c] }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
        <span className="muted">
          Ziehen zum Verschieben · Doppelklick zum Schreiben · synchron mit dem 2D-Client
        </span>
      </div>
      <div className="board">
        <svg className="arrows">
          {arrows.map((arrow) => {
            const from = board?.notes[arrow.from]
            const to = board?.notes[arrow.to]
            if (!from || !to) return null
            const a = center(from)
            const b = center(to)
            return <line key={arrow.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          })}
        </svg>
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} scale={BOARD_SCALE} boardId={id} />
        ))}
      </div>
    </Modal>
  )
}

// ---------- vending machine ----------

function VendingDialog() {
  const pick = (d: Drink) => {
    drink(d)
    close()
  }
  return (
    <Modal title="🥤 Getränkeautomat">
      <p>Was darf’s sein? (geht aufs Haus)</p>
      <div className="drinks">
        {(Object.keys(DRINKS) as Drink[]).map((d) => (
          <button key={d} onClick={() => pick(d)}>
            <span className="emoji">{DRINKS[d].emoji}</span>
            {DRINKS[d].label}
          </button>
        ))}
      </div>
    </Modal>
  )
}

export default function Dialogs() {
  const dialog = useGame((s) => s.dialog)
  if (!dialog) return null
  switch (dialog.kind) {
    case 'computer':
      return <ComputerDialog key={dialog.id} id={dialog.id} />
    case 'whiteboard':
      return <WhiteboardDialog key={dialog.id} id={dialog.id} />
    case 'vending':
      return <VendingDialog />
  }
}
