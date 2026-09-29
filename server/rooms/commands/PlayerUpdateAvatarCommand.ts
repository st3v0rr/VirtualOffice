import { Command } from '@colyseus/command'
import type { Client } from 'colyseus'
import type { SkyOffice } from '../SkyOffice.ts'
import { parseAvatar, serializeAvatar } from '../../../types/Avatar.ts'

type Payload = {
  client: Client
  avatar: unknown
}

export default class PlayerUpdateAvatarCommand extends Command<SkyOffice, Payload> {
  execute(data: Payload) {
    const { client, avatar } = data

    const player = this.room.state.players.get(client.sessionId)
    const parsed = parseAvatar(avatar)
    if (!player || !parsed) return
    // store the normalized form, so equal avatars always have the same string (cache key)
    player.avatar = serializeAvatar(parsed)
  }
}
