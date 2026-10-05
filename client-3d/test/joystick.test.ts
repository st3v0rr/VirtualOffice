import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = (file: string) => path.join(import.meta.dirname, '..', 'src', file)

describe('on-screen joystick removal', () => {
  it('the Joystick component file no longer exists', () => {
    expect(existsSync(src('ui/Joystick.tsx'))).toBe(false)
  })

  it('App no longer imports or renders a joystick, on mobile or otherwise', () => {
    const app = readFileSync(src('App.tsx'), 'utf8')
    expect(app).not.toMatch(/joystick/i)
  })

  it('no joystick-only input state remains in the shared intent module', () => {
    const intent = readFileSync(src('game/intent.ts'), 'utf8')
    expect(intent).not.toMatch(/joystick/i)
  })

  it('no joystick-only CSS rules remain', () => {
    const css = readFileSync(src('index.css'), 'utf8')
    expect(css).not.toMatch(/joystick/i)
  })

  it('the local player no longer reads joystick input', () => {
    const localPlayer = readFileSync(src('player/LocalPlayer.tsx'), 'utf8')
    expect(localPlayer).not.toMatch(/joystick/i)
  })
})
