import { DRINK_DURATION, EMOTE_DURATION, DRINKS, type Drink, type Emote } from '../avatar/motion'
import { setHandUp, showBubble, showEffect, useGame } from '../state/game'
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
  const id = useGame.getState().sessionId
  if (id) showEffect(id, emote)
}

// raise the hand, or lower it if it is up; it stays until toggled again
export function toggleHand() {
  const raised = !me.motion.handRaised
  me.motion.handRaised = raised
  network.sendHand(raised)
  const id = useGame.getState().sessionId
  if (id) setHandUp(id, raised)
}

// a drink from the vending machine: in the hand for a while, others see it too
export function drink(kind: Drink) {
  me.motion.holding = { drink: kind, until: clock.now + DRINK_DURATION }
  me.motion.emote = 'gulp'
  me.motion.emoteSince = clock.now
  network.sendEmote(`drink:${kind}`)
  const id = useGame.getState().sessionId
  if (id) showBubble(id, `${DRINKS[kind].emoji} *schlürf*`)
}
