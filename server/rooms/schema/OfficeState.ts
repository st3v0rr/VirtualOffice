import { Schema, ArraySchema, SetSchema, MapSchema, type } from '@colyseus/schema'
import type { IPlayer, IOfficeState, IComputer, IChatMessage } from '../../../types/IOfficeState.ts'

export class Player extends Schema implements IPlayer {
  @type('string') name = ''
  @type('number') x = 705
  @type('number') y = 500
  @type('string') anim = 'adam_idle_down'
  @type('string') avatar = ''
  @type('number') rot = 0
}

export class Computer extends Schema implements IComputer {
  @type({ set: 'string' }) connectedUser = new SetSchema<string>()
}

export class ChatMessage extends Schema implements IChatMessage {
  @type('string') author = ''
  @type('number') createdAt = new Date().getTime()
  @type('string') content = ''
}

export class OfficeState extends Schema implements IOfficeState {
  @type({ map: Player })
  players = new MapSchema<Player>()

  @type({ map: Computer })
  computers = new MapSchema<Computer>()

  @type([ChatMessage])
  chatMessages = new ArraySchema<ChatMessage>()
}
