import { Command } from '@colyseus/command'
import type { Client } from 'colyseus'
import type { SkyOffice } from '../SkyOffice.ts'
import { validateAvatar } from '../validation.ts'

type Payload = {
  client: Client
  avatar: unknown
}

export default class PlayerUpdateAvatarCommand extends Command<SkyOffice, Payload> {
  execute(data: Payload) {
    const { client } = data
    const avatar = validateAvatar(data.avatar)
    if (avatar === null) return

    const player = this.room.state.players.get(client.sessionId)

    if (!player) return
    player.avatar = avatar
  }
}
