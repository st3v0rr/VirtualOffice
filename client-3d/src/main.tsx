import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Gallery from './ui/Gallery'
import * as players from './net/players'
import * as interactables from './game/interactables'
import { intent } from './game/intent'
import { useGame } from './state/game'
import { useSettings } from './state/settings'
import { compileOffice } from './map/compile'
import { loadOfficeMap } from './map/load'
import { getOffice, setOffice } from './map/office'
import './index.css'

const params = new URLSearchParams(location.search)
const root = createRoot(document.getElementById('root')!)
const render = (node: ReactNode) => root.render(<StrictMode>{node}</StrictMode>)

async function start() {
  if (params.has('gallery')) return render(<Gallery />)
  // the map editor (?editor) is its own chunk, the office doesn't load it
  if (params.has('editor')) {
    const { default: MapEditor } = await import('./editor/MapEditor')
    return render(<MapEditor />)
  }
  // the pastel background while the office map loads
  render(<div className="app" />)
  const { map } = await loadOfficeMap()
  setOffice(compileOffice(map))
  render(<App />)
}

start()

// for automated tests and debugging in the browser console (dev server, or ?debug)
if (import.meta.env.DEV || params.has('debug')) {
  const game = { ...players, useGame, intent, ...interactables }
  Object.defineProperties(game, {
    office: { get: getOffice },
    chairs: { get: () => interactables.interactablesOf().chairs },
    computers: { get: () => interactables.interactablesOf().computers },
    vendingMachines: { get: () => interactables.interactablesOf().vendingMachines },
  })
  Object.assign(window, { __game: game, __settings: useSettings })
}
