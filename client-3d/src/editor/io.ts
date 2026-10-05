import type { VirtualOfficeMap } from '../../../types/map/format'
import { formatMap } from '../../../types/map/serialize'
import { describeIssues, parseMap, type MapValidation } from '../../../types/map/validate'

// Maps leave and enter the editor as files: exported in the stable layout of the map file
// (types/map/serialize.ts), imported only after the full validation. Between visits the
// editor keeps a draft in the browser (localStorage); nothing is ever written to the server.

export const DRAFT_KEY = 'virtualoffice.mapEditor.draft'

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const exportMap = (map: VirtualOfficeMap) => formatMap(map)

export const importMap = (text: string): MapValidation => parseMap(text)

// "Mein Büro 2" -> mein-buero-2.json
export function mapFileName(map: Pick<VirtualOfficeMap, 'name'>) {
  const slug = map.name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'office'}.json`
}

// false if the browser refused (storage full or disabled)
export function saveDraft(storage: DraftStorage, map: VirtualOfficeMap) {
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(map))
    return true
  } catch {
    return false
  }
}

// the draft of the last visit, if there is a valid one
export function loadDraft(storage: DraftStorage): VirtualOfficeMap | null {
  let text: string | null
  try {
    text = storage.getItem(DRAFT_KEY)
  } catch {
    return null
  }
  if (!text) return null
  const result = parseMap(text)
  if (result.ok) return result.map
  console.warn(
    `The saved draft of the map editor is not valid and is ignored:\n${describeIssues(result.errors)}`
  )
  return null
}

export function clearDraft(storage: DraftStorage) {
  try {
    storage.removeItem(DRAFT_KEY)
  } catch {
    // nothing to clear
  }
}

// offers the map as a file to save (browser only)
export function downloadMap(map: VirtualOfficeMap) {
  const url = URL.createObjectURL(new Blob([exportMap(map)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = mapFileName(map)
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
