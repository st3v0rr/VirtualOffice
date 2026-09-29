import type { Interactable } from './interactables'

// Requests from the scene (clicks) to the local player, handled in its frame loop.
export const intent = {
  // walk to this item and use it
  use: null as Interactable | null,
  // walk to this point
  walkTo: null as { x: number; z: number } | null,
}

// the touch joystick, in screen directions (x right, y up), length 0..1
export const joystick = { x: 0, y: 0 }
