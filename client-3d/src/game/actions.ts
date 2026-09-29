import { EMOTE_DURATION, type Emote } from '../avatar/motion'
import { me } from '../net/players'
import { network } from '../net/network'

// shared clock time for starting animations outside of useFrame
export const clock = { now: 0 }

export function playEmote(emote: Emote) {
  const motion = me.motion
  if (motion.emote && clock.now - motion.emoteSince < EMOTE_DURATION[motion.emote] * 0.5) return
  motion.emote = emote
  motion.emoteSince = clock.now
  network.sendEmote(emote)
}
