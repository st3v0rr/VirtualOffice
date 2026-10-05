import { describe, expect, it } from 'vitest'
import { defaultZoom } from '../src/world/cameraZoom'

describe('defaultZoom', () => {
  it('zooms out further on mobile (touch) than on desktop', () => {
    const desktop = defaultZoom(false)
    const mobile = defaultZoom(true)
    // a smaller orthographic zoom shows more of the scene: mobile should be < desktop
    expect(mobile).toBe(44)
    expect(mobile).toBeLessThan(desktop)
  })
})
