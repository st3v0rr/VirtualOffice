import { Command } from '@colyseus/command'
import type { Client } from 'colyseus'
import type { SkyOffice } from '../SkyOffice.ts'

// an avatar is a handful of part names and colours, so anything longer is not one
const MAX_AVATAR_LENGTH = 1000

type Payload = {
  client: Client
  avatar: unknown
}

export default class PlayerUpdateAvatarCommand extends Command<SkyOffice, Payload> {
  execute(data: Payload) {
    const { client, avatar } = data
    if (typeof avatar !== 'string' || avatar.length > MAX_AVATAR_LENGTH) return
    try {
      const parsed = JSON.parse(avatar)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return
    } catch {
      return
    }

    const player = this.room.state.players.get(client.sessionId)

    if (!player) return
    player.avatar = avatar
  }
}
