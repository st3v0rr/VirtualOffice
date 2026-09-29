import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Chibi from '../avatar/Chibi'
import { createMotion, type Emote, type MotionState } from '../avatar/motion'
import {
  BOTTOM_STYLES,
  CLOTH_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  LABELS,
  PRESETS,
  PRESET_TEXTURES,
  SKIN_COLORS,
  TOP_STYLES,
  randomAvatar,
  saveAvatar,
  type Avatar,
} from '../avatar/avatar'
import { useGame } from '../state/game'
import { network } from '../net/network'
import { Box, Cyl } from '../world/parts'

// Character editor: pick the parts and colours, see the chibi turn and move.

function Preview({
  avatar,
  state,
  emote,
}: {
  avatar: Avatar
  state: MotionState
  emote: { e: Emote | null; n: number }
}) {
  const [motion] = useState(createMotion)
  const lastEmote = useRef(0)
  useFrame(({ clock }) => {
    if (motion.state !== state) {
      motion.state = state
      motion.since = clock.elapsedTime
    }
    motion.speed = state === 'walk' ? 0.7 : 0
    if (emote.e && emote.n !== lastEmote.current) {
      lastEmote.current = emote.n
      motion.emote = emote.e
      motion.emoteSince = clock.elapsedTime
    }
  })
  return (
    <group position={[0, -0.55, 0]}>
      {state === 'sit' && (
        <group position={[0, 0, 0]}>
          <Box size={[0.48, 0.1, 0.46]} position={[0, 0.28, 0]} color="#c9d6ee" />
          <Box size={[0.46, 0.4, 0.09]} position={[0, 0.5, -0.22]} color="#c9d6ee" />
          <Cyl top={0.18} bottom={0.2} height={0.05} position={[0, 0.025, 0]} color="#9e98b0" />
        </group>
      )}
      <Cyl top={0.7} height={0.06} position={[0, -0.03, 0]} color="#f7e3ef" />
      <Chibi avatar={avatar} motion={motion} />
    </group>
  )
}

function Swatches({
  colors,
  value,
  onChange,
}: {
  colors: string[]
  value: string
  onChange: (c: string) => void
}) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button
          key={c}
          className={`swatch ${c === value ? 'active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      <label className="swatch custom" title="Eigene Farbe">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

function Choice<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  labels?: Record<string, string>
}) {
  return (
    <div className="choices">
      {options.map((o) => (
        <button key={o} className={o === value ? 'active' : ''} onClick={() => onChange(o)}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  )
}

export default function AvatarEditor() {
  const saved = useGame((s) => s.avatar)
  const [avatar, setAvatar] = useState<Avatar>(saved)
  const [state, setState] = useState<MotionState>('idle')
  const [emote, setEmote] = useState<{ e: Emote | null; n: number }>({ e: null, n: 0 })
  const patch = (p: Partial<Avatar>) => setAvatar((a) => ({ ...a, ...p }))
  const close = () => useGame.getState().set({ editorOpen: false })

  const save = () => {
    saveAvatar(avatar)
    useGame.getState().set({ avatar, hasSavedAvatar: true, editorOpen: false })
    network.sendAvatar(avatar)
  }

  return (
    <div className="modal-backdrop" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div className="modal editor">
        <div className="editor-preview">
          <Canvas flat dpr={[1, 2]} camera={{ position: [0, 0.9, 4.4], fov: 30 }}>
            <hemisphereLight args={['#fff4fb', '#cbb8e0', 1.4]} />
            <directionalLight position={[3, 5, 4]} intensity={1.6} color="#fff3e2" />
            <Preview avatar={avatar} state={state} emote={emote} />
            <OrbitControls
              enablePan={false}
              minDistance={1.8}
              maxDistance={5}
              autoRotate
              autoRotateSpeed={1.2}
              target={[0, 0.1, 0]}
            />
          </Canvas>
          <div className="preview-actions">
            <Choice
              options={['idle', 'walk', 'sit'] as const}
              value={state}
              onChange={setState}
              labels={{ idle: 'Stehen', walk: 'Laufen', sit: 'Sitzen' }}
            />
            <div className="choices">
              <button onClick={() => setEmote((x) => ({ e: 'wave', n: x.n + 1 }))}>
                👋 Winken
              </button>
              <button onClick={() => setEmote((x) => ({ e: 'cheer', n: x.n + 1 }))}>
                🎉 Jubeln
              </button>
            </div>
          </div>
        </div>
        <div className="editor-options">
          <h2>Dein Charakter</h2>
          <div className="row">
            <span>Vorlagen</span>
            <div className="choices">
              {PRESET_TEXTURES.map((p) => (
                <button key={p} onClick={() => setAvatar(PRESETS[p])}>
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
              <button onClick={() => setAvatar(randomAvatar())}>🎲 Zufall</button>
            </div>
          </div>
          <div className="row">
            <span>Hautfarbe</span>
            <Swatches
              colors={SKIN_COLORS}
              value={avatar.skin}
              onChange={(skin) => patch({ skin })}
            />
          </div>
          <div className="row">
            <span>Frisur</span>
            <Choice
              options={HAIR_STYLES}
              value={avatar.hair}
              onChange={(hair) => patch({ hair })}
              labels={LABELS}
            />
          </div>
          <div className="row">
            <span>Haarfarbe</span>
            <Swatches
              colors={HAIR_COLORS}
              value={avatar.hairColor}
              onChange={(hairColor) => patch({ hairColor })}
            />
          </div>
          <div className="row">
            <span>Oberteil</span>
            <Choice
              options={TOP_STYLES}
              value={avatar.top}
              onChange={(top) => patch({ top })}
              labels={LABELS}
            />
            <Swatches
              colors={CLOTH_COLORS}
              value={avatar.topColor}
              onChange={(topColor) => patch({ topColor })}
            />
          </div>
          <div className="row">
            <span>Hose</span>
            <Choice
              options={BOTTOM_STYLES}
              value={avatar.bottom}
              onChange={(bottom) => patch({ bottom })}
              labels={LABELS}
            />
            <Swatches
              colors={CLOTH_COLORS}
              value={avatar.bottomColor}
              onChange={(bottomColor) => patch({ bottomColor })}
            />
          </div>
          <div className="row">
            <span title="So sehen dich Leute im 2D-Client">Figur im 2D-Client</span>
            <Choice
              options={PRESET_TEXTURES}
              value={avatar.texture}
              onChange={(texture) => patch({ texture })}
            />
          </div>
          <div className="editor-buttons">
            <button className="secondary" onClick={close}>
              Abbrechen
            </button>
            <button className="primary" onClick={save}>
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
