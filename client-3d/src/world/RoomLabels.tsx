import { Html } from '@react-three/drei'

// little floating signs with the room names (the zones of the map plus the rooms
// that have no zone, in tile coordinates)
const LABELS: { name: string; x: number; z: number }[] = [
  { name: 'Konferenzsaal', x: 9.5, z: 7.5 },
  { name: 'Lounge', x: 26, z: 7 },
  { name: 'Chefbüro', x: 40, z: 4 },
  { name: 'Meetingraum', x: 26, z: 17.6 },
  { name: 'Großraumbüro', x: 46, z: 11.5 },
  { name: 'Bibliothek (Ruhe)', x: 17, z: 25.8 },
  { name: 'Flur', x: 30, z: 13 },
]

export default function RoomLabels() {
  return (
    <>
      {LABELS.map((label) => (
        <Html
          key={label.name}
          position={[label.x, 0.05, label.z]}
          zIndexRange={[5, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="room-label">{label.name}</div>
        </Html>
      ))}
    </>
  )
}
