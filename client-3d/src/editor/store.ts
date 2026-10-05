import { create } from 'zustand'
import type { VirtualOfficeMap } from '../../../types/map/format'
import type { MapIssue } from '../../../types/map/validate'

// The state of the map editor: the map being edited with its undo history, what is
// selected, and the tool. Every change goes through apply(); a drag (begin ... end) is one
// step of the history, however many moves it had.

export type Selection =
  { kind: 'placement' | 'zone' | 'label'; id: string } | { kind: 'spawn' } | null

export type Tool = 'select' | 'place' | 'brush' | 'fill' | 'room' | 'zone' | 'label' | 'spawn'

// where the map in the editor came from
export type MapSource = 'draft' | 'server' | 'built-in' | 'import' | 'new'

const HISTORY_LIMIT = 200

type EditorData = {
  map: VirtualOfficeMap | null
  source: MapSource | null
  // changed in the editor (then it is kept as a draft in the browser)
  edited: boolean
  past: VirtualOfficeMap[]
  future: VirtualOfficeMap[]
  // the map when the current drag began
  gesture: VirtualOfficeMap | null
  selection: Selection
  tool: Tool
  // the asset of the place tool, the tile type of the painting tools
  asset: string
  tile: string
  view: '2d' | '3d'
  // collision and reachability on top of the 2D map
  overlay: boolean
  // pixels per tile in the 2D view
  zoom: number
  message: { text: string; error?: boolean } | null
  importErrors: { file: string; issues: MapIssue[] } | null
}

type EditorState = EditorData & {
  set: (patch: Partial<EditorData>) => void
  load: (map: VirtualOfficeMap, source: MapSource) => void
  apply: (update: (map: VirtualOfficeMap) => VirtualOfficeMap, selection?: Selection) => void
  begin: () => void
  end: () => void
  undo: () => void
  redo: () => void
}

export const INITIAL: EditorData = {
  map: null,
  source: null,
  edited: false,
  past: [],
  future: [],
  gesture: null,
  selection: null,
  tool: 'select',
  asset: 'plant',
  tile: '#',
  view: '2d',
  overlay: false,
  zoom: 18,
  message: null,
  importErrors: null,
}

// the selection, if what it points to is still there
export function validSelection(map: VirtualOfficeMap | null, selection: Selection): Selection {
  if (!map || !selection || selection.kind === 'spawn') return map ? selection : null
  const list =
    selection.kind === 'placement'
      ? map.placements
      : selection.kind === 'zone'
        ? map.zones
        : map.labels
  return list.some((item) => item.id === selection.id) ? selection : null
}

const remember = (past: VirtualOfficeMap[], map: VirtualOfficeMap) =>
  [...past, map].slice(-HISTORY_LIMIT)

export const useEditor = create<EditorState>()((set, get) => ({
  ...INITIAL,
  set: (patch) => set(patch),

  // a whole new map (loaded, imported, new); undoable like any other change
  load: (map, source) => {
    const { map: current, past } = get()
    set({
      map,
      source,
      // a file or a new map exists only here; a map from the server or the draft is saved
      edited: source === 'import' || source === 'new',
      past: current ? remember(past, current) : [],
      future: [],
      gesture: null,
      selection: null,
      tile: map.tileTypes[get().tile] ? get().tile : Object.keys(map.tileTypes)[0],
    })
  },

  apply: (update, selection) => {
    const { map, past, gesture } = get()
    if (!map) return
    const next = update(map)
    const patch: Partial<EditorData> = selection === undefined ? {} : { selection }
    if (next === map) return set(patch)
    // during a drag the history gets the map from before the drag, at its end
    if (gesture) set({ ...patch, map: next, edited: true })
    else set({ ...patch, map: next, edited: true, past: remember(past, map), future: [] })
  },

  begin: () => set({ gesture: get().map }),

  end: () => {
    const { map, gesture, past } = get()
    if (!gesture) return
    if (map && map !== gesture) set({ gesture: null, past: remember(past, gesture), future: [] })
    else set({ gesture: null })
  },

  undo: () => {
    const { map, past, future, selection } = get()
    const previous = past.at(-1)
    if (!map || !previous) return
    set({
      map: previous,
      edited: true,
      past: past.slice(0, -1),
      future: [map, ...future],
      selection: validSelection(previous, selection),
    })
  },

  redo: () => {
    const { map, past, future, selection } = get()
    const next = future[0]
    if (!map || !next) return
    set({
      map: next,
      edited: true,
      past: remember(past, map),
      future: future.slice(1),
      selection: validSelection(next, selection),
    })
  },
}))
