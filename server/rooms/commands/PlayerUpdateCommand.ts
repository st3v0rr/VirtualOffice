import { Command } from '@colyseus/command'
import type { Client } from 'colyseus'
import type { SkyOffice } from '../SkyOffice.ts'
import { validatePlayerUpdate } from '../validation.ts'

type Payload = {
  client: Client
  x: unknown
  y: unknown
  anim: unknown
  rot?: unknown
}

export default class PlayerUpdateCommand extends Command<SkyOffice, Payload> {
  execute(data: Payload) {
    const { client } = data
    const update = validatePlayerUpdate(data)
    if (!update) return

    const player = this.room.state.players.get(client.sessionId)

    if (!player) return
    player.x = update.x
    player.y = update.y
    player.anim = update.anim
    if (update.rot !== undefined) player.rot = update.rot
  }
}
