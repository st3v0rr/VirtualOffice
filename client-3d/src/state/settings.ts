import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PostFx = 'off' | 'pixel' | 'outline'

type Settings = {
  // inverted-hull outlines on characters and furniture
  outlines: boolean
  postFx: PostFx
  // FPS / draw call overlay
  stats: boolean
  // cut-away walls in front of rooms, so the camera can look inside
  lowWalls: boolean
  set: (patch: Partial<Omit<Settings, 'set'>>) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      outlines: true,
      postFx: 'off',
      stats: import.meta.env.DEV,
      lowWalls: true,
      set: (patch) => set(patch),
    }),
    { name: 'skyoffice3d.settings' }
  )
)
