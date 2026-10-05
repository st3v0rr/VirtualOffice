import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useGame } from '../state/game'
import { useSettings, type PostFx } from '../state/settings'
import { network } from '../net/network'

// Settings and the keyboard/mouse controls in one dialog, opened from the HUD.

const CONTROLS: [keys: string[], action: string][] = [
  [['W', 'A', 'S', 'D'], 'Laufen'],
  [['←', '↑', '→', '↓'], 'Laufen (Pfeiltasten)'],
  [['Klick'], 'Hinlaufen (mobil: Tippen)'],
  [['E'], 'Hinsetzen / Aufstehen'],
  [['R'], 'Benutzen'],
  [['Leertaste'], 'Hüpfen'],
  [['1'], 'Winken'],
  [['2'], 'Jubeln'],
  [['Mausrad'], 'Zoomen'],
  [['Enter'], 'Chat'],
]

const FOCUSABLE = 'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'

const close = () => useGame.getState().set({ settingsOpen: false })

export default function SettingsModal() {
  const s = useSettings()
  const name = useGame((g) => g.name)
  const [newName, setNewName] = useState(name)
  const dialog = useRef<HTMLDivElement>(null)
  // close only when a click both starts and ends on the backdrop itself
  const downOnBackdrop = useRef(false)

  useEffect(() => {
    // capture: also closes while the name input (which stops propagation) has the focus
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    const opener = document.activeElement
    dialog.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey, true)
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  // keep Tab inside the dialog
  const trapTab = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab' || !dialog.current) return
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === dialog.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) close()
        downOnBackdrop.current = false
      }}
    >
      <div
        ref={dialog}
        className="modal dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        onKeyDown={trapTab}
      >
        <div className="settings-head">
          <h2 id="settings-title">⚙️ Einstellungen & Steuerung</h2>
          <button className="secondary settings-x" aria-label="Schließen" onClick={close}>
            ✕
          </button>
        </div>
        <div className="settings-body">
          <section aria-labelledby="settings-section">
            <h3 id="settings-section">Einstellungen</h3>
            <label className="settings-field">
              <span>Name</span>
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
              <small className="muted">Enter zum Speichern</small>
            </label>
            <label className="settings-field">
              <span>Look</span>
              <select
                value={s.postFx}
                onChange={(e) => s.set({ postFx: e.target.value as PostFx })}
              >
                <option value="off">Klar (Standard)</option>
                <option value="pixel">Pixel-Look (Post-FX)</option>
                <option value="outline">Kanten-Post-FX</option>
              </select>
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={s.outlines}
                onChange={(e) => s.set({ outlines: e.target.checked })}
              />
              Konturen (Inverted Hull)
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={s.lowWalls}
                onChange={(e) => s.set({ lowWalls: e.target.checked })}
              />
              Vordere Wände absenken
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={s.stats}
                onChange={(e) => s.set({ stats: e.target.checked })}
              />
              FPS-Anzeige
            </label>
          </section>
          <section aria-labelledby="controls-section">
            <h3 id="controls-section">Steuerung</h3>
            <dl className="controls">
              {CONTROLS.map(([keys, action]) => (
                <div key={action}>
                  <dt>
                    {keys.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
        <div className="editor-buttons">
          <button className="secondary" onClick={close}>
            Schließen (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
