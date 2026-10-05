import type { VirtualOfficeMap } from '../../../types/map/format'

// a small valid map: one room with walls around, a chair, a computer, an L-shaped desk,
// a media zone and a label
export function tinyMap(): VirtualOfficeMap {
  return {
    format: 'virtualoffice-map',
    version: 1,
    name: 'Tiny',
    tileSize: 32,
    width: 6,
    height: 5,
    tileTypes: {
      '.': { kind: 'void', name: 'Leer' },
      '#': { kind: 'wall', name: 'Wand', color: '#eeeeee' },
      f: { kind: 'floor', name: 'Boden', color: '#dddddd' },
    },
    tiles: ['######', '#ffff#', '#ffff#', '#ffff#', '######'],
    spawn: { x: 2.5, y: 2.5 },
    labels: [{ id: 'room', text: 'Raum', x: 3, y: 1.5 }],
    zones: [{ id: 'z1', name: 'Meeting', type: 'meeting', x: 1, y: 1, w: 2, h: 2 }],
    assets: [],
    placements: [
      { id: 'chair-1', asset: 'chair', x: 1, y: 3, w: 1, h: 1, rotation: 90, color: '#aabbcc' },
      { id: 'pc-1', asset: 'computer', x: 3, y: 1, w: 2, h: 1 },
      { id: 'desk-1', asset: 'desk', x: 3, y: 2, w: 2, h: 2, solid: ['#.', '##'] },
    ],
  }
}
