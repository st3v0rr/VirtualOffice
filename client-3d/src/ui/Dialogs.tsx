import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useGame } from '../state/game'
import { network } from '../net/network'
import { ScreenShareSession } from '@virtualoffice/media'
import { DRINKS, type Drink } from '../avatar/motion'
import { drink } from '../game/actions'
import { distanceTo, interactablesOf } from '../game/interactables'
import { me as myPlayer } from '../net/players'

// Dialogs for the computers and the vending machine.

const NO_USERS: string[] = []
const close = () => useGame.getState().set({ dialog: null })

function Modal({ title, wide, children }: { title: string; wide?: boolean; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
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

function ComputerDialog({ id, minimized }: { id: string; minimized: boolean }) {
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
  // screen on its monitor; using the computer again opens it
  const setMinimized = (minimized: boolean) =>
    useGame.getState().set({ dialog: { kind: 'computer', id, minimized } })

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
    const computer = interactablesOf().computers.find((c) => c.id === id)
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
      return <ComputerDialog key={dialog.id} id={dialog.id} minimized={!!dialog.minimized} />
    case 'vending':
      return <VendingDialog />
  }
}
