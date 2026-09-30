import { Command } from '@colyseus/command'
import type { Client } from 'colyseus'
import type { SkyOffice } from '../SkyOffice.ts'
import { sanitizeName } from '../validation.ts'

type Payload = {
  client: Client
  name: unknown
}

export default class PlayerUpdateNameCommand extends Command<SkyOffice, Payload> {
  execute(data: Payload) {
    const { client } = data
    const name = sanitizeName(data.name)
    if (name === null) return

    const player = this.room.state.players.get(client.sessionId)

    if (!player) return
    player.name = name
  }
}
