import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Gallery from './ui/Gallery'
import * as players from './net/players'
import * as interactables from './game/interactables'
import { intent } from './game/intent'
import { useGame } from './state/game'
import { useSettings } from './state/settings'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(location.search).has('gallery') ? <Gallery /> : <App />}
  </StrictMode>
)

// for automated tests and debugging in the browser console (dev server, or ?debug)
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, {
    __game: { ...players, useGame, intent, ...interactables },
    __settings: useSettings,
  })
}
