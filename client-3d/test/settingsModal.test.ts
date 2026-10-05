import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) =>
  readFileSync(path.join(import.meta.dirname, '..', 'src', file), 'utf8')

describe('combined settings & controls dialog', () => {
  const hud = read('ui/Hud.tsx')
  const modal = read('ui/SettingsModal.tsx')

  it('the HUD has one labelled button for it and no separate settings or help popovers', () => {
    expect(hud).toMatch(/aria-label="Einstellungen & Steuerung"/)
    expect(hud).toMatch(/title="Einstellungen & Steuerung"/)
    expect(hud).not.toContain('❓')
    expect(hud).not.toMatch(/className="panel (settings|help)"/)
    expect(hud).not.toMatch(/setHelp|function Settings/)
    expect(hud.match(/⚙️/g)).toHaveLength(1)
  })

  it('is a modal dialog in the standard modal shell', () => {
    expect(modal).toContain('className="modal-backdrop"')
    expect(modal).toMatch(/className="modal dialog settings-dialog"/)
    expect(modal).toContain('role="dialog"')
    expect(modal).toContain('aria-modal="true"')
  })

  it('has every setting, and the name is saved on Enter', () => {
    for (const key of ['outlines', 'lowWalls', 'stats', 'postFx'])
      expect(modal).toMatch(new RegExp(`s\\.set\\(\\{ ${key}:`))
    expect(modal).toContain("localStorage.setItem('skyoffice3d.name'")
    expect(modal).toContain('network.sendName(')
  })

  it('lists all controls', () => {
    for (const text of [
      "'W', 'A', 'S', 'D'",
      'Pfeiltasten',
      "'Klick'",
      'Hinsetzen / Aufstehen',
      'Benutzen',
      'Leertaste',
      'Winken',
      'Jubeln',
      'Mausrad',
      "'Enter'], 'Chat'",
    ])
      expect(modal).toContain(text)
  })

  it('blocks the keyboard shortcuts of the local player while open', () => {
    expect(read('player/LocalPlayer.tsx')).toMatch(/settingsOpen/)
  })

  it('the old popover styles are gone', () => {
    const css = read('index.css')
    expect(css).not.toMatch(/^\.settings \{/m)
    expect(css).not.toMatch(/^\.help \{/m)
  })
})
