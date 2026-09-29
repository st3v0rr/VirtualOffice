import { Command } from '@colyseus/command'
import type { Client } from 'colyseus'
import type { SkyOffice } from '../SkyOffice.ts'

type Payload = {
  client: Client
  x: number
  y: number
  anim: string
  // only sent by the 3D client
  rot?: number
}

export default class PlayerUpdateCommand extends Command<SkyOffice, Payload> {
  execute(data: Payload) {
    const { client, x, y, anim, rot } = data

    const player = this.room.state.players.get(client.sessionId)

    if (!player) return
    player.x = x
    player.y = y
    player.anim = anim
    if (typeof rot === 'number' && Number.isFinite(rot)) player.rot = rot
  }
}
