import type { AssetCategory, ZoneType } from '../../../types/map/format'

// Names, colours and hints of the editor's UI.

export const ZONE_INFO: Record<ZoneType, { name: string; color: string; hint: string }> = {
  meeting: {
    name: 'Besprechungsraum',
    color: '#8fd3e8',
    hint: 'Alle im Raum hören und sehen sich, niemand von draußen.',
  },
  focus: {
    name: 'Fokusraum',
    color: '#b5e8a3',
    hint: 'Wie ein Besprechungsraum, für kleine Runden.',
  },
  quiet: {
    name: 'Ruhezone',
    color: '#c9a7f5',
    hint: 'Kein Video und kein Audio.',
  },
  auditorium: {
    name: 'Saal (Publikum)',
    color: '#ffd48a',
    hint: 'Alle im Saal hören die Bühne, das Publikum selbst spricht nicht.',
  },
  stage: {
    name: 'Bühne',
    color: '#ff9aa2',
    hint: 'Spricht zum ganzen Saal; muss innerhalb eines Saals liegen.',
  },
}

export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  seating: '#cbc3ec',
  tables: '#f1cfa3',
  storage: '#e7c39c',
  tech: '#cfe0f5',
  decor: '#c8ebc0',
  wall: '#ffd6e0',
  other: '#e6e1ee',
}

export const SOURCE_NAMES = {
  draft: 'Lokaler Entwurf',
  server: 'Karte des Servers',
  'built-in': 'Eingebaute Karte',
  import: 'Importierte Datei',
  new: 'Neue Karte',
} as const
