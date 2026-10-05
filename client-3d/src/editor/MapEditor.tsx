import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { VirtualOfficeMap } from '../../../types/map/format'
import { describeIssues } from '../../../types/map/validate'
import { loadOfficeMap } from '../map/load'
import { analyzeMap } from './analysis'
import Grid2D from './Grid2D'
import Inspector, { Problems } from './Inspector'
import { clearDraft, downloadMap, importMap, loadDraft, mapFileName, saveDraft } from './io'
import { SOURCE_NAMES } from './labels'
import * as ops from './ops'
import Palette from './Palette'
import { useEditor, type Selection } from './store'
import './editor.css'

// The map editor (/?editor): edits a map in the browser, tries it in 3D and saves it as a
// file. It never writes to the server; how a saved map gets into the office is in the help
// box and in docs/map-format.md.

const Preview3D = lazy(() => import('./Preview3D'))

const isTyping = () => {
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  )
}

// moves the selection by (dx, dy) tiles
function nudge(map: VirtualOfficeMap, selection: NonNullable<Selection>, dx: number, dy: number) {
  switch (selection.kind) {
    case 'placement': {
      const p = ops.findPlacement(map, selection.id)
      return p ? ops.movePlacement(map, p.id, p.x + dx, p.y + dy) : map
    }
    case 'zone': {
      const z = map.zones.find((zone) => zone.id === selection.id)
      return z ? ops.updateZone(map, z.id, { x: z.x + dx, y: z.y + dy }) : map
    }
    case 'label': {
      const l = map.labels.find((label) => label.id === selection.id)
      return l ? ops.updateLabel(map, l.id, { x: l.x + dx, y: l.y + dy }) : map
    }
    case 'spawn':
      return ops.setSpawn(map, map.spawn.x + dx, map.spawn.y + dy)
  }
}

function remove(map: VirtualOfficeMap, selection: NonNullable<Selection>) {
  switch (selection.kind) {
    case 'placement':
      return ops.deletePlacement(map, selection.id)
    case 'zone':
      return ops.deleteZone(map, selection.id)
    case 'label':
      return ops.deleteLabel(map, selection.id)
    case 'spawn':
      return map
  }
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

function onKeyDown(e: KeyboardEvent) {
  if (isTyping()) return
  const s = useEditor.getState()
  const { map, selection } = s
  if (!map) return
  const key = e.key.toLowerCase()
  if (e.ctrlKey || e.metaKey) {
    if (key === 'z') s[e.shiftKey ? 'redo' : 'undo']()
    else if (key === 'y') s.redo()
    else if (key === 'd' && selection?.kind === 'placement') {
      const copy = ops.duplicatePlacement(map, selection.id)
      s.apply(() => copy.map, { kind: 'placement', id: copy.id })
    } else return
    e.preventDefault()
    return
  }
  if (e.key === 'Escape') return s.set({ selection: null, tool: 'select' })
  if (key === 'v') return s.set({ tool: 'select' })
  if (key === 'b') return s.set({ tool: 'brush', selection: null })
  if (!selection) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    s.apply((m) => remove(m, selection), selection.kind === 'spawn' ? selection : null)
  } else if (key === 'r' && selection.kind === 'placement') {
    s.apply((m) => ops.rotatePlacement(m, selection.id, e.shiftKey ? 1 : -1))
  } else if (ARROWS[e.key]) {
    e.preventDefault()
    const step = e.shiftKey ? 0.25 : 1
    const [dx, dy] = ARROWS[e.key]
    s.apply((m) => nudge(m, selection, dx * step, dy * step))
  }
}

export default function MapEditor() {
  const map = useEditor((s) => s.map)
  const source = useEditor((s) => s.source)
  const view = useEditor((s) => s.view)
  const overlay = useEditor((s) => s.overlay)
  const zoom = useEditor((s) => s.zoom)
  const message = useEditor((s) => s.message)
  const importErrors = useEditor((s) => s.importErrors)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const set = useEditor((s) => s.set)
  const main = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [draftSaved, setDraftSaved] = useState<boolean | null>(null)

  // the checks run a moment after the edits, so dragging stays smooth
  const checked = useDeferredValue(map)
  const report = useMemo(() => (checked ? analyzeMap(checked) : null), [checked])
  const office = report?.office ?? null

  // start with the draft of the last visit, else the map of the server
  useEffect(() => {
    let cancelled = false
    if (useEditor.getState().map) return
    const draft = loadDraft(localStorage)
    if (draft) {
      useEditor.getState().load(draft, 'draft')
      return
    }
    loadOfficeMap().then(({ map, source }) => {
      if (!cancelled && !useEditor.getState().map) useEditor.getState().load(map, source)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // keep edits in the browser, so a reload or a closed tab loses nothing
  useEffect(() => {
    let timer: number | undefined
    const unsubscribe = useEditor.subscribe((state, previous) => {
      if (!state.edited || !state.map || state.map === previous.map) return
      const current = state.map
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setDraftSaved(saveDraft(localStorage, current)), 300)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // the whole map in view when a map with another size comes in (once the view is there)
  const width = map?.width
  const height = map?.height
  const ready = !!report
  useEffect(() => {
    const el = main.current
    if (!el || !width || !height || !ready) return
    const fit = Math.min((el.clientWidth - 40) / width, (el.clientHeight - 80) / height)
    useEditor.getState().set({ zoom: Math.max(6, Math.min(48, Math.floor(fit))) })
  }, [width, height, ready])

  if (!map || !report) {
    return (
      <div className="map-editor loading">
        <p>Lade die Karte …</p>
      </div>
    )
  }

  const loadServerMap = async () => {
    const loaded = await loadOfficeMap()
    clearDraft(localStorage)
    setDraftSaved(null)
    useEditor.getState().load(loaded.map, loaded.source)
    set({
      message: {
        text: `${SOURCE_NAMES[loaded.source]} geladen. Rückgängig holt den Entwurf zurück.`,
      },
    })
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    const result = importMap(await file.text())
    if (!result.ok) {
      set({ importErrors: { file: file.name, issues: result.errors } })
      console.warn(`Import of ${file.name} failed:\n${describeIssues(result.errors)}`)
      return
    }
    useEditor.getState().load(result.map, 'import')
    set({ message: { text: `„${result.map.name}“ aus ${file.name} importiert.` } })
  }

  const onExport = () => {
    if (report.errors.length)
      return set({
        message: {
          text: 'Die Karte hat noch Fehler (siehe Prüfung) und kann so nicht ins Büro.',
          error: true,
        },
      })
    downloadMap(map)
    set({
      message: {
        text: `Gespeichert als ${mapFileName(map)}. Ins Büro kommt sie als assets/map/office.json (neu bauen) oder per OFFICE_MAP_PATH auf dem Server.`,
      },
    })
  }

  const zoomBy = (factor: number) =>
    set({ zoom: Math.max(4, Math.min(64, Math.round(zoom * factor))) })

  return (
    <div className="map-editor">
      <header className="map-editor-head">
        <h1>
          🗺️ Karten<span>editor</span>
        </h1>
        <span className="map-name" title={SOURCE_NAMES[source ?? 'server']}>
          {map.name} <span className="muted">· {SOURCE_NAMES[source ?? 'server']}</span>
        </span>
        <div className="map-editor-toolbar" role="toolbar" aria-label="Karte">
          <button
            type="button"
            onClick={() => useEditor.getState().undo()}
            disabled={!canUndo}
            title="Rückgängig (Strg+Z)"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={() => useEditor.getState().redo()}
            disabled={!canRedo}
            title="Wiederholen (Strg+Umschalt+Z)"
          >
            ↷
          </button>
          <button type="button" onClick={() => useEditor.getState().load(ops.createMap(), 'new')}>
            Neu
          </button>
          <button
            type="button"
            onClick={loadServerMap}
            title="Die Karte laden, die der Server gerade benutzt"
          >
            Karte des Servers laden
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Importieren …
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            data-testid="editor-import"
            onChange={(e) => {
              onImport(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button type="button" className="primary" onClick={onExport}>
            Exportieren
          </button>
        </div>
        <div className="map-editor-toolbar view" role="toolbar" aria-label="Ansicht">
          <button
            type="button"
            className={view === '2d' ? 'active' : undefined}
            aria-pressed={view === '2d'}
            onClick={() => set({ view: '2d' })}
          >
            2D
          </button>
          <button
            type="button"
            className={view === '3d' ? 'active' : undefined}
            aria-pressed={view === '3d'}
            onClick={() => set({ view: '3d' })}
          >
            3D-Vorschau
          </button>
        </div>
        <a className="back" href={import.meta.env.BASE_URL}>
          Zum Büro
        </a>
      </header>

      <Palette />

      <main className="map-editor-main" ref={main}>
        {view === '2d' ? (
          <Grid2D office={office} />
        ) : office ? (
          <Suspense fallback={<p className="muted center">Lade die 3D-Vorschau …</p>}>
            <Preview3D office={office} />
          </Suspense>
        ) : (
          <p className="muted center">Die Karte hat Fehler, es gibt noch keine Vorschau.</p>
        )}
        {view === '2d' && (
          <div className="canvas-controls">
            <label className="check">
              <input
                type="checkbox"
                checked={overlay}
                onChange={(e) => set({ overlay: e.target.checked })}
              />
              Kollision &amp; Erreichbarkeit
            </label>
            <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Verkleinern">
              −
            </button>
            <button type="button" onClick={() => zoomBy(1.25)} aria-label="Vergrößern">
              +
            </button>
          </div>
        )}
      </main>

      <Inspector report={report} />

      <footer className="map-editor-status" role="status">
        <span className={report.errors.length ? 'bad' : report.warnings.length ? 'warn' : 'good'}>
          {report.errors.length
            ? `⛔ ${report.errors.length} Fehler`
            : report.warnings.length
              ? `⚠️ ${report.warnings.length} Hinweis(e)`
              : '✓ Gültig'}
        </span>
        <span className="muted">
          {map.width} × {map.height} Felder · {map.placements.length} Objekte
          {draftSaved === true && ' · Entwurf im Browser gespeichert'}
          {draftSaved === false && ' · Entwurf konnte nicht gespeichert werden'}
        </span>
        {message && (
          <span className={message.error ? 'message error' : 'message'}>{message.text}</span>
        )}
      </footer>

      {importErrors && (
        <div className="modal-backdrop" onClick={() => set({ importErrors: null })}>
          <div
            className="modal dialog import-errors"
            role="alertdialog"
            aria-label="Import fehlgeschlagen"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Import fehlgeschlagen</h2>
            <p>
              <strong>{importErrors.file}</strong> ist keine gültige VirtualOffice-Karte:
            </p>
            <Problems report={{ errors: importErrors.issues, warnings: [], office: null }} />
            <button type="button" className="secondary" onClick={() => set({ importErrors: null })}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
