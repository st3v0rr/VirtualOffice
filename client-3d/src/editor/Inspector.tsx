import type { ReactNode } from 'react'
import { findAsset } from '../../../types/map/catalog'
import {
  ZONE_TYPES,
  type MapLabel,
  type MapZone,
  type Placement,
  type TileKind,
  type VirtualOfficeMap,
  type ZoneType,
} from '../../../types/map/format'
import type { MapReport } from './analysis'
import { ZONE_INFO } from './labels'
import * as ops from './ops'
import { useEditor } from './store'

// The right side of the editor: the properties of what is selected, or of the map.

type Commit<T> = (value: T) => void

// commits on Enter or when leaving the field, so typing is one step of the history; the
// field starts over (key) when the value changes elsewhere, e.g. by dragging
function NumberField(props: {
  label: string
  value: number
  onCommit: Commit<number>
  step?: number
  min?: number
}) {
  const commit = (input: HTMLInputElement) => {
    const value = Number(input.value)
    if (input.value.trim() && Number.isFinite(value) && value !== props.value) props.onCommit(value)
    else input.value = String(props.value)
  }
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        key={props.value}
        type="number"
        step={props.step ?? 0.25}
        min={props.min}
        defaultValue={props.value}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget)}
      />
    </label>
  )
}

function TextField(props: {
  label: string
  value: string
  onCommit: Commit<string>
  max?: number
}) {
  const commit = (input: HTMLInputElement) => {
    const value = input.value.trim()
    if (value && value !== props.value) props.onCommit(value)
    else input.value = props.value
  }
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        key={props.value}
        defaultValue={props.value}
        maxLength={props.max ?? 60}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget)}
      />
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

const apply = (update: (map: VirtualOfficeMap) => VirtualOfficeMap) =>
  useEditor.getState().apply(update)
const remove = (update: (map: VirtualOfficeMap) => VirtualOfficeMap) =>
  useEditor.getState().apply(update, null)

function PlacementInspector({ map, p }: { map: VirtualOfficeMap; p: Placement }) {
  const info = findAsset(map, p.asset)
  const collides = p.collides ?? info?.collides ?? false
  const color = p.color ?? info?.color
  const duplicate = () => {
    const copy = ops.duplicatePlacement(map, p.id)
    useEditor.getState().apply(() => copy.map, { kind: 'placement', id: copy.id })
  }
  return (
    <Section title={`${info?.icon ?? ''} ${info?.name ?? p.asset}`}>
      <p className="muted">
        ID <code>{p.id}</code>
        {info?.role && ' · benutzbar'}
        {info?.mount === 'wall' && ' · hängt an der Wand darunter'}
      </p>
      <div className="field-row">
        <NumberField
          label="X"
          value={p.x}
          onCommit={(x) => apply((m) => ops.movePlacement(m, p.id, x, p.y))}
        />
        <NumberField
          label="Y"
          value={p.y}
          onCommit={(y) => apply((m) => ops.movePlacement(m, p.id, p.x, y))}
        />
      </div>
      {info?.resizable && (
        <div className="field-row">
          <NumberField
            label="Breite"
            value={p.w}
            min={0.25}
            onCommit={(w) => apply((m) => ops.resizePlacement(m, p.id, w, p.h))}
          />
          <NumberField
            label="Tiefe"
            value={p.h}
            min={0.25}
            onCommit={(h) => apply((m) => ops.resizePlacement(m, p.id, p.w, h))}
          />
        </div>
      )}
      {info?.rotatable && (
        <div className="field-row rotate">
          <span>Drehung {p.rotation ?? 0}°</span>
          <button
            type="button"
            title="Gegen den Uhrzeigersinn (Umschalt+R)"
            onClick={() => apply((m) => ops.rotatePlacement(m, p.id, 1))}
          >
            ⟲
          </button>
          <button
            type="button"
            title="Im Uhrzeigersinn (R)"
            onClick={() => apply((m) => ops.rotatePlacement(m, p.id, -1))}
          >
            ⟳
          </button>
        </div>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={collides}
          onChange={(e) => {
            const value = e.target.checked
            apply((m) =>
              ops.updatePlacement(m, p.id, {
                collides: value === info?.collides ? undefined : value,
              })
            )
          }}
        />
        Blockiert den Weg
      </label>
      {color && (
        <label className="field color">
          <span>Farbe</span>
          <input
            type="color"
            value={color}
            onChange={(e) => {
              const value = e.target.value
              apply((m) => ops.updatePlacement(m, p.id, { color: value }))
            }}
          />
        </label>
      )}
      {collides && ops.canMask(p) && p.w * p.h <= 64 && (
        <div className="mask">
          <span>Blockierte Felder (klicken zum Umschalten)</span>
          <div className="mask-grid" style={{ gridTemplateColumns: `repeat(${p.w}, 1.4em)` }}>
            {Array.from({ length: p.h }, (_, y) =>
              Array.from({ length: p.w }, (_, x) => {
                const solid = (p.solid?.[y][x] ?? '#') === '#'
                return (
                  <button
                    key={`${x},${y}`}
                    type="button"
                    className={solid ? 'solid' : 'free'}
                    aria-label={`Feld ${x + 1}/${y + 1}: ${solid ? 'blockiert' : 'frei'}`}
                    aria-pressed={solid}
                    onClick={() => apply((m) => ops.setSolidCell(m, p.id, x, y, !solid))}
                  />
                )
              })
            )}
          </div>
        </div>
      )}
      <div className="buttons">
        <button type="button" onClick={duplicate} title="Strg+D">
          Duplizieren
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => remove((m) => ops.deletePlacement(m, p.id))}
          title="Entf"
        >
          Löschen
        </button>
      </div>
    </Section>
  )
}

function ZoneInspector({ zone }: { zone: MapZone }) {
  const update = (patch: Partial<MapZone>) => apply((m) => ops.updateZone(m, zone.id, patch))
  return (
    <Section title={`🎧 Medienzone`}>
      <TextField label="Name" value={zone.name} onCommit={(name) => update({ name })} />
      <label className="field">
        <span>Art</span>
        <select value={zone.type} onChange={(e) => update({ type: e.target.value as ZoneType })}>
          {ZONE_TYPES.map((type) => (
            <option key={type} value={type}>
              {ZONE_INFO[type].name}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">{ZONE_INFO[zone.type].hint}</p>
      <div className="field-row">
        <NumberField label="X" value={zone.x} onCommit={(x) => update({ x })} />
        <NumberField label="Y" value={zone.y} onCommit={(y) => update({ y })} />
      </div>
      <div className="field-row">
        <NumberField label="Breite" value={zone.w} min={0.25} onCommit={(w) => update({ w })} />
        <NumberField label="Höhe" value={zone.h} min={0.25} onCommit={(h) => update({ h })} />
      </div>
      <div className="buttons">
        <button
          type="button"
          className="danger"
          onClick={() => remove((m) => ops.deleteZone(m, zone.id))}
        >
          Zone löschen
        </button>
      </div>
    </Section>
  )
}

function LabelInspector({ label }: { label: MapLabel }) {
  const update = (patch: Partial<MapLabel>) => apply((m) => ops.updateLabel(m, label.id, patch))
  return (
    <Section title="🏷️ Raumschild">
      <TextField label="Text" value={label.text} onCommit={(text) => update({ text })} />
      <div className="field-row">
        <NumberField label="X" value={label.x} onCommit={(x) => update({ x })} />
        <NumberField label="Y" value={label.y} onCommit={(y) => update({ y })} />
      </div>
      <div className="buttons">
        <button
          type="button"
          className="danger"
          onClick={() => remove((m) => ops.deleteLabel(m, label.id))}
        >
          Schild löschen
        </button>
      </div>
    </Section>
  )
}

function SpawnInspector({ map }: { map: VirtualOfficeMap }) {
  return (
    <Section title="📍 Startpunkt">
      <p className="muted">
        Hier erscheinen alle, die das Büro betreten. Er muss auf einem Boden liegen.
      </p>
      <div className="field-row">
        <NumberField
          label="X"
          value={map.spawn.x}
          onCommit={(x) => apply((m) => ops.setSpawn(m, x, m.spawn.y))}
        />
        <NumberField
          label="Y"
          value={map.spawn.y}
          onCommit={(y) => apply((m) => ops.setSpawn(m, m.spawn.x, y))}
        />
      </div>
    </Section>
  )
}

const KIND_NAMES: Record<TileKind, string> = { floor: 'Boden', wall: 'Wand', void: 'Leer' }

function MapInspector({ map }: { map: VirtualOfficeMap }) {
  const set = useEditor((s) => s.set)
  const select = (selection: Parameters<typeof set>[0]['selection']) =>
    set({ selection, tool: 'select' })
  const resize = (width: number, height: number) => {
    const result = ops.resizeMap(map, width, height)
    useEditor.getState().apply(() => result.map, null)
    if (result.removed)
      set({ message: { text: `${result.removed} Objekte lagen außerhalb und wurden entfernt.` } })
  }
  const addTile = (kind: TileKind) => {
    const added = ops.addTileType(map, {
      kind,
      name: kind === 'wall' ? 'Neue Wand' : 'Neuer Boden',
      color: kind === 'wall' ? '#ece4f4' : '#f3efe8',
    })
    useEditor.getState().apply(() => added.map)
    set({ tile: added.key, tool: 'brush' })
  }
  const counts = {
    chairs: map.placements.filter((p) => findAsset(map, p.asset)?.role === 'chair').length,
    computers: map.placements.filter((p) => findAsset(map, p.asset)?.role === 'computer').length,
  }
  return (
    <>
      <Section title="🗺️ Karte">
        <TextField
          label="Name"
          value={map.name}
          max={80}
          onCommit={(name) => apply((m) => ({ ...m, name }))}
        />
        <div className="field-row">
          <NumberField
            label="Breite (Felder)"
            value={map.width}
            step={1}
            min={1}
            onCommit={(w) => resize(w, map.height)}
          />
          <NumberField
            label="Höhe (Felder)"
            value={map.height}
            step={1}
            min={1}
            onCommit={(h) => resize(map.width, h)}
          />
        </div>
        <p className="muted">
          {map.placements.length} Objekte · {counts.chairs} Stühle · {counts.computers} Computer
        </p>
      </Section>
      <Section title="Beläge">
        <ul className="tile-types">
          {Object.entries(map.tileTypes).map(([key, type]) => (
            <li key={key}>
              {type.kind === 'void' ? (
                <span className="tile-swatch void" />
              ) : (
                <input
                  type="color"
                  aria-label={`Farbe von ${type.name}`}
                  value={type.color}
                  onChange={(e) => {
                    const color = e.target.value
                    apply((m) => ops.updateTileType(m, key, { color }))
                  }}
                />
              )}
              <TextField
                label={`${KIND_NAMES[type.kind]} „${key}“`}
                value={type.name}
                max={40}
                onCommit={(name) => apply((m) => ops.updateTileType(m, key, { name }))}
              />
              <button
                type="button"
                title={ops.tileTypeUsed(map, key) ? 'Wird noch benutzt' : 'Entfernen'}
                disabled={ops.tileTypeUsed(map, key)}
                onClick={() => apply((m) => ops.removeTileType(m, key))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="buttons">
          <button type="button" onClick={() => addTile('floor')}>
            + Boden
          </button>
          <button type="button" onClick={() => addTile('wall')}>
            + Wand
          </button>
        </div>
      </Section>
      <Section title={`Medienzonen (${map.zones.length})`}>
        <ul className="item-list">
          {map.zones.map((z) => (
            <li key={z.id}>
              <button type="button" onClick={() => select({ kind: 'zone', id: z.id })}>
                <span className="dot" style={{ background: ZONE_INFO[z.type].color }} />
                {z.name} <span className="muted">{ZONE_INFO[z.type].name}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={`Raumschilder (${map.labels.length})`}>
        <ul className="item-list">
          {map.labels.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => select({ kind: 'label', id: l.id })}>
                {l.text}
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}

export function Problems({ report }: { report: MapReport }) {
  if (!report.errors.length && !report.warnings.length)
    return <p className="ok">✓ Die Karte ist gültig, alles ist erreichbar.</p>
  return (
    <ul className="problems">
      {report.errors.map((issue, i) => (
        <li key={`e${i}`} className="error">
          {issue.path && <code>{issue.path}</code>} {issue.message}
        </li>
      ))}
      {report.warnings.map((warning, i) => (
        <li key={`w${i}`} className="warning">
          {warning.message}
        </li>
      ))}
    </ul>
  )
}

export default function Inspector({ report }: { report: MapReport }) {
  const map = useEditor((s) => s.map)!
  const selection = useEditor((s) => s.selection)
  let content: ReactNode
  if (selection?.kind === 'placement') {
    const p = ops.findPlacement(map, selection.id)
    content = p && <PlacementInspector map={map} p={p} />
  } else if (selection?.kind === 'zone') {
    const zone = map.zones.find((z) => z.id === selection.id)
    content = zone && <ZoneInspector zone={zone} />
  } else if (selection?.kind === 'label') {
    const label = map.labels.find((l) => l.id === selection.id)
    content = label && <LabelInspector label={label} />
  } else if (selection?.kind === 'spawn') {
    content = <SpawnInspector map={map} />
  }
  return (
    <aside className="map-editor-panel map-editor-inspector" aria-label="Eigenschaften">
      {content ?? <MapInspector map={map} />}
      <Section title="Prüfung">
        <Problems report={report} />
      </Section>
    </aside>
  )
}
