import { Schema, ArraySchema, SetSchema, MapSchema, type } from '@colyseus/schema'
import type {
  IPlayer,
  IOfficeState,
  IComputer,
  IWhiteboard,
  INote,
  IArrow,
  IChatMessage,
} from '../../../types/IOfficeState.ts'

export class Player extends Schema implements IPlayer {
  @type('string') name = ''
  @type('number') x = 705
  @type('number') y = 500
  @type('string') anim = 'adam_idle_down'
  // serialized AvatarDescription (see types/Avatar.ts), empty for clients without the editor
  @type('string') avatar = ''
}

export class Computer extends Schema implements IComputer {
  @type({ set: 'string' }) connectedUser = new SetSchema<string>()
}

export class Note extends Schema implements INote {
  @type('number') x = 0
  @type('number') y = 0
  @type('number') width = 0
  @type('number') height = 0
  @type('string') text = ''
  @type('string') color = ''
  @type('string') author = ''
}

export class Arrow extends Schema implements IArrow {
  @type('string') from = ''
  @type('string') to = ''
  @type('string') fromSide = ''
  @type('string') toSide = ''
}

export class Whiteboard extends Schema implements IWhiteboard {
  @type({ set: 'string' }) connectedUser = new SetSchema<string>()
  @type({ map: Note }) notes = new MapSchema<Note>()
  @type({ map: Arrow }) arrows = new MapSchema<Arrow>()
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

  @type({ map: Whiteboard })
  whiteboards = new MapSchema<Whiteboard>()

  @type([ChatMessage])
  chatMessages = new ArraySchema<ChatMessage>()
}
