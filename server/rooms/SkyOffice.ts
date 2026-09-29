import bcrypt from 'bcryptjs'
import { Room, ServerError, type Client } from 'colyseus'
import { Dispatcher } from '@colyseus/command'
import { Player, OfficeState, Computer, Whiteboard } from './schema/OfficeState.ts'
import { Message } from '../../types/Messages.ts'
import type { IRoomData } from '../../types/Rooms.ts'
import { officeMap } from '../officeMap.ts'
import { createMediaGrant } from '../media.ts'
import { getMediaLocation, type MediaTokenRequest } from '../../types/Media.ts'
import PlayerUpdateCommand from './commands/PlayerUpdateCommand.ts'
import PlayerUpdateNameCommand from './commands/PlayerUpdateNameCommand.ts'
import PlayerUpdateAvatarCommand from './commands/PlayerUpdateAvatarCommand.ts'
import {
  ComputerAddUserCommand,
  ComputerRemoveUserCommand,
} from './commands/ComputerUpdateArrayCommand.ts'
import {
  WhiteboardAddUserCommand,
  WhiteboardRemoveUserCommand,
} from './commands/WhiteboardUpdateArrayCommand.ts'
import ChatMessageUpdateCommand from './commands/ChatMessageUpdateCommand.ts'
import {
  WhiteboardAddArrowCommand,
  WhiteboardAddNoteCommand,
  WhiteboardDeleteArrowCommand,
  WhiteboardDeleteNoteCommand,
  WhiteboardUpdateNoteCommand,
} from './commands/WhiteboardBoardCommands.ts'
import type {
  AddArrowMessage,
  AddNoteMessage,
  DeleteArrowMessage,
  DeleteNoteMessage,
  UpdateNoteMessage,
} from '../../types/Whiteboard.ts'

export class SkyOffice extends Room<{ state: OfficeState }> {
  state = new OfficeState()
  private dispatcher = new Dispatcher(this)
  private name: string
  private description: string
  private password: string | null = null

  async onCreate(options: IRoomData) {
    const { name, description, password, autoDispose } = options
    this.name = name
    this.description = description
    this.autoDispose = autoDispose

    let hasPassword = false
    if (password) {
      const salt = await bcrypt.genSalt(10)
      this.password = await bcrypt.hash(password, salt)
      hasPassword = true
    }
    this.setMetadata({ name, description, hasPassword })

    // one entry per computer and whiteboard placed in the map
    for (const id of officeMap.computerIds) {
      this.state.computers.set(id, new Computer())
    }
    for (const id of officeMap.whiteboardIds) {
      this.state.whiteboards.set(id, new Whiteboard())
    }

    // when a player connect to a computer, add to the computer connectedUser array
    this.onMessage(Message.CONNECT_TO_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerAddUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player disconnect from a computer, remove from the computer connectedUser array
    this.onMessage(Message.DISCONNECT_FROM_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerRemoveUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player connect to a whiteboard, add to the whiteboard connectedUser array
    this.onMessage(Message.CONNECT_TO_WHITEBOARD, (client, message: { whiteboardId: string }) => {
      this.dispatcher.dispatch(new WhiteboardAddUserCommand(), {
        client,
        whiteboardId: message.whiteboardId,
      })
    })

    // when a player disconnect from a whiteboard, remove from the whiteboard connectedUser array
    this.onMessage(
      Message.DISCONNECT_FROM_WHITEBOARD,
      (client, message: { whiteboardId: string }) => {
        this.dispatcher.dispatch(new WhiteboardRemoveUserCommand(), {
          client,
          whiteboardId: message.whiteboardId,
        })
      }
    )

    // sticky notes and arrows on a whiteboard
    this.onMessage(Message.WHITEBOARD_ADD_NOTE, (client, message: AddNoteMessage) => {
      this.dispatcher.dispatch(new WhiteboardAddNoteCommand(), { ...message, client })
    })
    this.onMessage(Message.WHITEBOARD_UPDATE_NOTE, (client, message: UpdateNoteMessage) => {
      this.dispatcher.dispatch(new WhiteboardUpdateNoteCommand(), { ...message, client })
    })
    this.onMessage(Message.WHITEBOARD_DELETE_NOTE, (client, message: DeleteNoteMessage) => {
      this.dispatcher.dispatch(new WhiteboardDeleteNoteCommand(), { ...message, client })
    })
    this.onMessage(Message.WHITEBOARD_ADD_ARROW, (client, message: AddArrowMessage) => {
      this.dispatcher.dispatch(new WhiteboardAddArrowCommand(), { ...message, client })
    })
    this.onMessage(Message.WHITEBOARD_DELETE_ARROW, (client, message: DeleteArrowMessage) => {
      this.dispatcher.dispatch(new WhiteboardDeleteArrowCommand(), { ...message, client })
    })

    // when receiving updatePlayer message, call the PlayerUpdateCommand
    this.onMessage(
      Message.UPDATE_PLAYER,
      (client, message: { x: number; y: number; anim: string }) => {
        this.dispatcher.dispatch(new PlayerUpdateCommand(), {
          client,
          x: message.x,
          y: message.y,
          anim: message.anim,
        })
      }
    )

    // when receiving updatePlayerName message, call the PlayerUpdateNameCommand
    this.onMessage(Message.UPDATE_PLAYER_NAME, (client, message: { name: string }) => {
      this.dispatcher.dispatch(new PlayerUpdateNameCommand(), {
        client,
        name: message.name,
      })
    })

    // the layered avatar, invalid descriptions are ignored
    this.onMessage(Message.UPDATE_PLAYER_AVATAR, (client, message: { avatar: string }) => {
      this.dispatcher.dispatch(new PlayerUpdateAvatarCommand(), {
        client,
        avatar: message?.avatar,
      })
    })

    // hand out a LiveKit token for the media room at the player's position or computer;
    // the server decides the room, so private rooms can't be joined from outside
    this.onMessage(Message.REQUEST_MEDIA_TOKEN, (client, request: MediaTokenRequest) =>
      this.createMediaGrant(client, request)
    )

    // when a player send a chat message, update the message array and broadcast to all connected clients except the sender
    this.onMessage(Message.ADD_CHAT_MESSAGE, (client, message: { content: string }) => {
      // update the message array (so that players join later can also see the message)
      this.dispatcher.dispatch(new ChatMessageUpdateCommand(), {
        client,
        content: message.content,
      })

      // broadcast to all currently connected clients except the sender (to render in-game dialog on top of the character)
      this.broadcast(
        Message.ADD_CHAT_MESSAGE,
        { clientId: client.sessionId, content: message.content },
        { except: client }
      )
    })
  }

  private async createMediaGrant(client: Client, request: MediaTokenRequest) {
    const player = this.state.players.get(client.sessionId)
    if (!player) throw new ServerError(404, 'Player not found')
    const participant = { identity: client.sessionId, name: player.name }

    if (request?.kind === 'computer') {
      const computerId = String(request.computerId)
      const computer = this.state.computers.get(computerId)
      if (!computer?.connectedUser.has(client.sessionId)) {
        throw new ServerError(403, 'Not connected to this computer')
      }
      const location = {
        room: `computer-${computerId}`,
        mode: 'everyone',
        canPublish: true,
      } as const
      return createMediaGrant(this.roomId, location, participant)
    }

    const location = getMediaLocation(officeMap.zones, player.x, player.y)
    return location ? createMediaGrant(this.roomId, location, participant) : null
  }

  async onAuth(client: Client, options: { password: string | null }) {
    if (this.password) {
      const validPassword = await bcrypt.compare(options.password, this.password)
      if (!validPassword) {
        throw new ServerError(403, 'Password is incorrect!')
      }
    }
    return true
  }

  onJoin(client: Client) {
    const player = new Player()
    player.x = officeMap.spawn.x
    player.y = officeMap.spawn.y
    this.state.players.set(client.sessionId, player)
    client.send(Message.SEND_ROOM_DATA, {
      id: this.roomId,
      name: this.name,
      description: this.description,
    })
  }

  onLeave(client: Client) {
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)
    }
    this.state.computers.forEach((computer) => {
      if (computer.connectedUser.has(client.sessionId)) {
        computer.connectedUser.delete(client.sessionId)
      }
    })
    this.state.whiteboards.forEach((whiteboard) => {
      if (whiteboard.connectedUser.has(client.sessionId)) {
        whiteboard.connectedUser.delete(client.sessionId)
      }
    })
  }

  onDispose() {
    console.log('room', this.roomId, 'disposing...')
    this.dispatcher.stop()
  }
}
