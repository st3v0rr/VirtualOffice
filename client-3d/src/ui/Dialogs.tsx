import { useEffect } from 'react'
import { useGame } from '../state/game'
import { network } from '../net/network'

// Dialogs for the computers, whiteboards and the vending machine.

function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  const close = () => useGame.getState().set({ dialog: null })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
        <button className="secondary close" onClick={close}>
          Schließen (Esc)
        </button>
      </div>
    </div>
  )
}

function ComputerDialog({ id }: { id: string }) {
  const users = useGame((s) => s.itemUsers[id] ?? [])
  const players = useGame((s) => s.players)
  const me = useGame((s) => s.sessionId)
  useEffect(() => {
    network.connectToComputer(id)
    return () => network.disconnectFromComputer(id)
  }, [id])
  return (
    <Modal title="💻 Computer">
      <p>
        Am Computer:{' '}
        {users.map((u) => (u === me ? 'Du' : (players[u]?.name ?? '…'))).join(', ') || '—'}
      </p>
      <p className="muted">Bildschirmfreigabe folgt (LiveKit).</p>
    </Modal>
  )
}

function WhiteboardDialog({ id }: { id: string }) {
  useEffect(() => {
    network.connectToWhiteboard(id)
    return () => network.disconnectFromWhiteboard(id)
  }, [id])
  return (
    <Modal title="📝 Whiteboard">
      <p className="muted">Whiteboard {id}</p>
    </Modal>
  )
}

function VendingDialog() {
  return (
    <Modal title="🥤 Getränkeautomat">
      <p>Prost!</p>
    </Modal>
  )
}

export default function Dialogs() {
  const dialog = useGame((s) => s.dialog)
  if (!dialog) return null
  switch (dialog.kind) {
    case 'computer':
      return <ComputerDialog id={dialog.id} />
    case 'whiteboard':
      return <WhiteboardDialog id={dialog.id} />
    case 'vending':
      return <VendingDialog />
  }
}
