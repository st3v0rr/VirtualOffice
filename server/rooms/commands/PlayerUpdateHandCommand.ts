import { Command } from '@colyseus/command'
import type { Client } from 'colyseus'
import type { SkyOffice } from '../SkyOffice.ts'
import { validateHandRaised } from '../validation.ts'

type Payload = {
  client: Client
  message: unknown
}

export default class PlayerUpdateHandCommand extends Command<SkyOffice, Payload> {
  execute(data: Payload) {
    const { client } = data
    const raised = validateHandRaised(data.message)
    if (raised === null) return

    const player = this.room.state.players.get(client.sessionId)

    if (!player) return
    player.handRaised = raised
  }
}
