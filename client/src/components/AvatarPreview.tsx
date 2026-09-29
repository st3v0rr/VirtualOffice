import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import type { AvatarDescription } from '../../../types/Avatar'
import { ensureAvatarTexture } from '../avatar/composeAvatar'
import { preloadLpcAssets } from '../avatar/lpcAssets'
import { CELL } from '../avatar/lpcLayout'

export type PreviewState = 'idle' | 'run' | 'sit'

const SCALE = 2
const SIZE = CELL * SCALE
// turn around once in a while, so all directions can be checked
const TURN_INTERVAL = 1600 // ms
const TURN_ORDER = ['down', 'left', 'up', 'right']

// a tiny game of its own, composing the avatar exactly like the office does
class PreviewScene extends Phaser.Scene {
  private sprite?: Phaser.GameObjects.Sprite
  private avatar?: AvatarDescription
  private state: PreviewState = 'idle'
  private direction = 0

  constructor() {
    super('avatar-preview')
  }

  preload() {
    preloadLpcAssets(this.load)
  }

  create() {
    this.sprite = this.add.sprite(SIZE / 2, SIZE / 2, '__DEFAULT').setScale(SCALE)
    this.time.addEvent({
      delay: TURN_INTERVAL,
      loop: true,
      callback: () => {
        this.direction = (this.direction + 1) % TURN_ORDER.length
        this.refresh()
      },
    })
    this.refresh()
  }

  show(avatar: AvatarDescription, state: PreviewState) {
    this.avatar = avatar
    this.state = state
    this.refresh()
  }

  private refresh() {
    if (!this.sprite || !this.avatar) return
    const key = ensureAvatarTexture(this, this.avatar)
    this.sprite.play(`${key}_${this.state}_${TURN_ORDER[this.direction]}`, true)
  }
}

type Props = {
  avatar: AvatarDescription
  state: PreviewState
}

export default function AvatarPreview({ avatar, state }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<PreviewScene | null>(null)

  useEffect(() => {
    const scene = new PreviewScene()
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current!,
      width: SIZE,
      height: SIZE,
      transparent: true,
      pixelArt: true,
      banner: false,
      audio: { noAudio: true },
      scene,
    })
    sceneRef.current = scene
    return () => {
      sceneRef.current = null
      game.destroy(true)
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.show(avatar, state)
  }, [avatar, state])

  return <div ref={containerRef} style={{ width: SIZE, height: SIZE }} />
}
