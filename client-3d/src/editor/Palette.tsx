import { useState } from 'react'
import { assetCatalog, CATEGORY_LABELS } from '../../../types/map/catalog'
import { ASSET_CATEGORIES } from '../../../types/map/format'
import { useEditor, type Tool } from './store'

// The left side of the editor: tools, floors and walls to paint, and the catalog of assets
// to place.

const TOOLS: { tool: Tool; icon: string; name: string; hint: string }[] = [
  { tool: 'select', icon: '🖱️', name: 'Auswählen', hint: 'Auswählen und ziehen (V)' },
  { tool: 'brush', icon: '🖌️', name: 'Pinsel', hint: 'Fliesen malen (B)' },
  { tool: 'fill', icon: '▦', name: 'Rechteck', hint: 'Rechteck mit dem Belag füllen' },
  { tool: 'room', icon: '🏠', name: 'Raum', hint: 'Rechteck mit Wänden außen und Boden innen' },
  {
    tool: 'zone',
    icon: '🎧',
    name: 'Medienzone',
    hint: 'Zone aufziehen (Besprechung, Ruhe, Saal …)',
  },
  { tool: 'label', icon: '🏷️', name: 'Raumschild', hint: 'Klicken, um ein Schild zu setzen' },
  { tool: 'spawn', icon: '📍', name: 'Startpunkt', hint: 'Klicken, wo neue Leute erscheinen' },
]

const PAINT_TOOLS: Tool[] = ['brush', 'fill', 'room']

export default function Palette() {
  const map = useEditor((s) => s.map)!
  const tool = useEditor((s) => s.tool)
  const tile = useEditor((s) => s.tile)
  const asset = useEditor((s) => s.asset)
  const set = useEditor((s) => s.set)
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()
  const catalog = assetCatalog(map).filter(
    (a) => !query || a.name.toLowerCase().includes(query) || a.id.toLowerCase().includes(query)
  )

  return (
    <aside className="map-editor-panel map-editor-palette" aria-label="Werkzeuge und Objekte">
      <section>
        <h2>Werkzeuge</h2>
        <div className="tool-grid" role="toolbar" aria-label="Werkzeuge">
          {TOOLS.map((t) => (
            <button
              key={t.tool}
              type="button"
              className={tool === t.tool ? 'active' : undefined}
              aria-pressed={tool === t.tool}
              title={t.hint}
              data-tool={t.tool}
              onClick={() =>
                set({
                  tool: t.tool,
                  selection: t.tool === 'select' ? useEditor.getState().selection : null,
                })
              }
            >
              <span aria-hidden>{t.icon}</span> {t.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Böden &amp; Wände</h2>
        <div className="tile-list">
          {Object.entries(map.tileTypes).map(([key, type]) => (
            <button
              key={key}
              type="button"
              className={tile === key && PAINT_TOOLS.includes(tool) ? 'active' : undefined}
              aria-pressed={tile === key && PAINT_TOOLS.includes(tool)}
              data-tile={key}
              title={`${type.name} (${type.kind === 'floor' ? 'begehbar' : type.kind === 'wall' ? 'Wand' : 'leer, nicht begehbar'})`}
              onClick={() => set({ tile: key, tool: PAINT_TOOLS.includes(tool) ? tool : 'brush' })}
            >
              <span className={`tile-swatch ${type.kind}`} style={{ background: type.color }} />
              {type.name}
            </button>
          ))}
        </div>
      </section>

      <section className="catalog">
        <h2>Möbel &amp; Objekte</h2>
        <input
          type="search"
          placeholder="Suchen …"
          aria-label="Objekte suchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {ASSET_CATEGORIES.map((category) => {
          const items = catalog.filter((a) => a.category === category)
          if (!items.length) return null
          return (
            <div key={category}>
              <h3>{CATEGORY_LABELS[category]}</h3>
              <div className="asset-list">
                {items.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    data-asset={a.id}
                    className={tool === 'place' && asset === a.id ? 'active' : undefined}
                    aria-pressed={tool === 'place' && asset === a.id}
                    title={`${a.name}: ${a.w} × ${a.h} Felder${a.collides ? ', blockiert den Weg' : ''}${a.mount === 'wall' ? ', hängt an der Wand' : ''}`}
                    onClick={() => set({ tool: 'place', asset: a.id, selection: null })}
                  >
                    <span className="asset-icon" aria-hidden>
                      {a.icon}
                    </span>
                    <span className="asset-name">{a.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </section>
    </aside>
  )
}
