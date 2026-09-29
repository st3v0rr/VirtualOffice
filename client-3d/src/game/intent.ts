import type { Interactable } from './interactables'

// Requests from the scene (clicks) to the local player, handled in its frame loop.
export const intent = {
  // walk to this item and use it
  use: null as Interactable | null,
  // walk to this point
  walkTo: null as { x: number; z: number } | null,
}
