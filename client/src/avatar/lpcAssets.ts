import Phaser from 'phaser'
import {
  BODIES,
  BOTTOMS,
  HAIRS,
  HAIR_COLORS,
  TOPS,
  type AvatarDescription,
} from '../../../types/Avatar'

// the files written by client/scripts/prepare-lpc.sh
const BASE_URL = 'assets/lpc'

type Layer = { key: string; tint?: number }

const bodyKey = (body: string) => `lpc/body/${body}`
const headKey = (body: string) => `lpc/head/${body}`
const hairKey = (hair: string, variant: string) => `lpc/hair/${hair}/${variant}`
const topKey = (top: string, bodyType: string) => `lpc/top/${top}/${bodyType}`
// teen and female bodies share the "thin" legs
const bottomKey = (bottom: string) => `lpc/bottom/${bottom}/thin`

/** all layer sheets, keyed like the textures they are loaded into */
function allLayerKeys() {
  const keys: string[] = []
  for (const body of BODIES) {
    keys.push(bodyKey(body.id), headKey(body.id))
    for (const top of TOPS) keys.push(topKey(top.id, body.bodyType))
  }
  const variants = new Set<string>(HAIR_COLORS.map((color) => color.variant))
  for (const hair of HAIRS) {
    if (hair.id === 'none') continue
    for (const variant of variants) keys.push(hairKey(hair.id, variant))
  }
  for (const bottom of BOTTOMS) keys.push(bottomKey(bottom.id))
  return [...new Set(keys)]
}

export function preloadLpcAssets(load: Phaser.Loader.LoaderPlugin) {
  for (const key of allLayerKeys()) {
    load.image(key, `${BASE_URL}/${key.slice('lpc/'.length)}.png`)
  }
}

/** the layer textures of an avatar, bottom to top (the z order of the LPC generator) */
export function avatarLayers(avatar: AvatarDescription): Layer[] {
  const body = BODIES.find((option) => option.id === avatar.body) ?? BODIES[0]
  const hairColor = HAIR_COLORS.find((option) => option.id === avatar.hairColor) ?? HAIR_COLORS[0]
  const layers: Layer[] = [
    { key: bodyKey(body.id) },
    { key: bottomKey(avatar.bottom) },
    { key: topKey(avatar.top, body.bodyType) },
    { key: headKey(body.id) },
  ]
  if (avatar.hair !== 'none') {
    layers.push({
      key: hairKey(avatar.hair, hairColor.variant),
      tint: 'tint' in hairColor ? hairColor.tint : undefined,
    })
  }
  return layers
}
