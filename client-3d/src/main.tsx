import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// for automated tests and debugging in the browser console (dev server only)
if (import.meta.env.DEV) {
  Promise.all([
    import('./net/players'),
    import('./state/game'),
    import('./game/intent'),
    import('./game/interactables'),
  ]).then(([players, game, intent, interactables]) => {
    Object.assign(window, {
      __game: { ...players, useGame: game.useGame, intent: intent.intent, ...interactables },
    })
  })
}
