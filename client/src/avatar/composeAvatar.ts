import Phaser from 'phaser'
import { serializeAvatar, type AvatarDescription } from '../../../types/Avatar'
import { avatarLayers } from './lpcAssets'
import {
  CELL,
  DIRECTIONS,
  LPC_ANIMS,
  SHEET_COLUMNS,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  frameIndex,
} from './lpcLayout'

export type ComposeTiming = {
  key: string
  avatar: string
  // stamping the layers, adding the frames and animations (CPU side)
  composeMs: number
  // until the next rendered game frame, which includes the GPU work
  firstFrameMs?: number
}

// the last compositions, for the dev tools (window.avatarTimings) and the PoC notes
export const composeTimings: ComposeTiming[] = []
;(window as any).avatarTimings = composeTimings

// FNV-1a, a short stable key; the serialized avatar itself contains '_', which the anim keys
// ("<texture>_<state>_<direction>") use as separator
function hash(value: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function isAvatarTexture(texture: string) {
  return texture.startsWith('lpc-')
}

export function avatarTextureKey(avatar: AvatarDescription) {
  return `lpc-${hash(serializeAvatar(avatar))}`
}

/**
 * The key of a spritesheet texture with all frames and animations ("<key>_idle_down", ...) of an
 * avatar. The layers are stamped onto one DynamicTexture (what a RenderTexture draws into) the first
 * time an avatar is needed, later calls with the same description reuse it.
 */
export function ensureAvatarTexture(scene: Phaser.Scene, avatar: AvatarDescription) {
  const serialized = serializeAvatar(avatar)
  const key = avatarTextureKey(avatar)
  if (scene.textures.exists(key)) return key

  const start = performance.now()
  const texture = scene.textures.addDynamicTexture(key, SHEET_WIDTH, SHEET_HEIGHT)!
  for (const layer of avatarLayers(avatar)) {
    texture.stamp(layer.key, undefined, 0, 0, {
      originX: 0,
      originY: 0,
      tint: layer.tint ?? 0xffffff,
    })
  }
  // Phaser 4 buffers the drawing commands until render()
  texture.render()

  for (let direction = 0; direction < DIRECTIONS.length; direction++) {
    for (let column = 0; column < SHEET_COLUMNS; column++) {
      const frame = frameIndex(direction, column)
      texture.add(frame, 0, column * CELL, direction * CELL, CELL, CELL)
    }
  }

  for (const [state, anim] of Object.entries(LPC_ANIMS)) {
    DIRECTIONS.forEach((direction, directionIndex) => {
      scene.anims.create({
        key: `${key}_${state}_${direction}`,
        frames: anim.frames.map((column) => ({
          key,
          frame: frameIndex(directionIndex, column),
        })),
        frameRate: anim.frameRate,
        repeat: anim.repeat,
      })
    })
  }

  const timing: ComposeTiming = { key, avatar: serialized, composeMs: performance.now() - start }
  scene.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
    timing.firstFrameMs = performance.now() - start
    console.log(
      `[avatar] composed ${serialized} as ${key}: ${timing.composeMs.toFixed(2)} ms, ` +
        `first frame after ${timing.firstFrameMs.toFixed(2)} ms`
    )
  })
  composeTimings.push(timing)
  if (composeTimings.length > 100) composeTimings.shift()
  return key
}
