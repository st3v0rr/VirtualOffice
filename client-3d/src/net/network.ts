import { Callbacks, Client, type Room } from '@colyseus/sdk'
import type { IOfficeState, IPlayer, IWhiteboard } from '../../../types/IOfficeState'
import { Message } from '../../../types/Messages'
import { RoomType } from '../../../types/Rooms'
import type { MediaGrant, MediaTokenRequest } from '../../../types/Media'
import type {
  AddNoteMessage,
  DeleteNoteMessage,
  HandleSide,
  NoteColor,
  UpdateNoteMessage,
} from '../../../types/Whiteboard'
import { useBoards } from '../state/boards'
import { avatarForTexture, parseAvatar, type Avatar } from '../avatar/avatar'
import { DRINKS, EMOTES, type Drink, type Emote } from '../avatar/motion'
import { toWorld } from '../map/office'
import { useGame, pushChat, showBubble } from '../state/game'
import { remotes, parseAnim, DIRECTION_ANGLE } from './players'

// how often my position is sent while moving, same as the 2D client (15 per second)
const PLAYER_UPDATE_INTERVAL = 66

type PlayerUpdate = { x: number; y: number; anim: string; rot: number }

function serverEndpoint() {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL as string
  const protocol = window.location.protocol.replace('http', 'ws')
  return `${protocol}//${window.location.hostname}:2567`
}

// the look of a player: its own avatar (3D client) or its 2D character as chibi
function avatarOf(player: IPlayer): Avatar {
  return parseAvatar(player.avatar) ?? avatarForTexture(parseAnim(player.anim).texture)
}

class Network {
  private client = new Client(serverEndpoint())
  room?: Room<any, IOfficeState>
  private pending?: PlayerUpdate
  private lastSent?: PlayerUpdate
  private lastSentAt = 0
  private timer?: number

  async join(name: string, avatar: Avatar, spawn: { x: number; y: number; anim: string }) {
    const game = useGame.getState()
    game.set({ connection: 'connecting', connectionError: undefined })
    try {
      this.room = await this.client.joinOrCreate(RoomType.PUBLIC)
    } catch (error) {
      console.error(error)
      game.set({
        connection: 'error',
        connectionError: `Server nicht erreichbar (${serverEndpoint()}). Läuft "npm run dev:server"?`,
      })
      return false
    }
    const room = this.room
    game.set({ connection: 'connected', sessionId: room.sessionId })
    this.listen(room)

    room.send(Message.UPDATE_PLAYER_NAME, { name })
    this.sendAvatar(avatar)
    this.sendPlayer({ ...spawn, rot: 0 })
    pushChat({ author: name, content: 'ist beigetreten (3D)', createdAt: Date.now(), system: true })

    room.onLeave(() => {
      useGame
        .getState()
        .set({ connection: 'error', connectionError: 'Verbindung zum Server verloren.' })
    })
    return true
  }

  private listen(room: Room<any, IOfficeState>) {
    const $ = Callbacks.get(room)
    const setPlayers = (fn: (players: ReturnType<typeof useGame.getState>['players']) => void) => {
      const players = { ...useGame.getState().players }
      fn(players)
      useGame.getState().set({ players })
    }

    $.onAdd('players', (player: IPlayer, id: string) => {
      if (id === room.sessionId) return
      const world = toWorld(player.x, player.y)
      const parsed = parseAnim(player.anim)
      remotes.set(id, {
        targetX: world.x,
        targetZ: world.z,
        rot: player.avatar ? player.rot : (DIRECTION_ANGLE[parsed.dir] ?? 0),
        state: parsed.state,
        fresh: true,
        emote: null,
        drink: null,
      })
      let announced = false
      const syncLook = () => {
        if (!player.name) return
        if (!announced) {
          announced = true
          pushChat({
            author: player.name,
            content: 'ist beigetreten',
            createdAt: Date.now(),
            system: true,
          })
        }
        setPlayers((players) => {
          players[id] = { name: player.name, avatar: avatarOf(player) }
        })
      }
      const syncMove = () => {
        const remote = remotes.get(id)
        if (!remote) return
        const w = toWorld(player.x, player.y)
        remote.targetX = w.x
        remote.targetZ = w.z
        const anim = parseAnim(player.anim)
        remote.state = anim.state
        // 3D players send their exact angle, 2D players only a direction
        remote.rot = player.avatar ? player.rot : (DIRECTION_ANGLE[anim.dir] ?? remote.rot)
      }
      $.listen(player, 'name', syncLook)
      $.listen(player, 'avatar', syncLook)
      $.listen(player, 'x', syncMove)
      $.listen(player, 'y', syncMove)
      $.listen(player, 'rot', syncMove)
      // a 2D player changing its character changes the texture in the anim
      $.listen(player, 'anim', (value: string, previous: string) => {
        syncMove()
        if (!player.avatar && previous && parseAnim(value).texture !== parseAnim(previous).texture)
          syncLook()
      })
    })

    $.onRemove('players', (player: IPlayer, id: string) => {
      remotes.delete(id)
      setPlayers((players) => {
        delete players[id]
      })
      if (player.name)
        pushChat({
          author: player.name,
          content: 'hat den Raum verlassen',
          createdAt: Date.now(),
          system: true,
        })
    })

    $.onAdd('chatMessages', (message: { author: string; content: string; createdAt: number }) => {
      pushChat({ author: message.author, content: message.content, createdAt: message.createdAt })
    })

    room.onMessage(
      Message.ADD_CHAT_MESSAGE,
      ({ clientId, content }: { clientId: string; content: string }) => {
        showBubble(clientId, content)
      }
    )

    room.onMessage(
      Message.PLAYER_EMOTE,
      ({ clientId, emote }: { clientId: string; emote: string }) => {
        const remote = remotes.get(clientId)
        if (!remote) return
        const [kind, arg] = String(emote).split(':')
        if (kind === 'drink' && arg in DRINKS) {
          remote.drink = arg as Drink
          remote.emote = 'hop'
        } else if (EMOTES.includes(kind as Emote)) {
          remote.emote = kind as Emote
        }
      }
    )

    // who is using which computer / whiteboard
    const trackUsers = (collection: 'computers' | 'whiteboards') => {
      $.onAdd(collection, (item: any, itemId: string) => {
        const update = () => {
          const users = Array.from(item.connectedUser.values()) as string[]
          useGame
            .getState()
            .set({ itemUsers: { ...useGame.getState().itemUsers, [itemId]: users } })
        }
        $.onAdd(item, 'connectedUser', update)
        $.onRemove(item, 'connectedUser', update)
      })
    }
    trackUsers('computers')
    trackUsers('whiteboards')

    // sticky notes and arrows of the whiteboards
    const boards = useBoards.getState()
    $.onAdd('whiteboards', (whiteboard: IWhiteboard, boardId: string) => {
      $.onAdd(whiteboard, 'notes', (note, noteId) => {
        const sync = () =>
          boards.upsertNote(boardId, {
            id: String(noteId),
            x: note.x,
            y: note.y,
            width: note.width,
            height: note.height,
            text: note.text,
            color: note.color as NoteColor,
            author: note.author,
          })
        sync()
        $.onChange(note, sync)
      })
      $.onRemove(whiteboard, 'notes', (_note, noteId) => boards.removeNote(boardId, String(noteId)))
      $.onAdd(whiteboard, 'arrows', (arrow, arrowId) =>
        boards.upsertArrow(boardId, {
          id: String(arrowId),
          from: arrow.from,
          to: arrow.to,
          fromSide: arrow.fromSide as HandleSide,
          toSide: arrow.toSide as HandleSide,
        })
      )
      $.onRemove(whiteboard, 'arrows', (_arrow, arrowId) =>
        boards.removeArrow(boardId, String(arrowId))
      )
    })

    room.onMessage(Message.SEND_ROOM_DATA, () => {})
  }

  // position in map pixels (sprite centre like the 2D client), anim in the 2D format
  sendPlayer(update: PlayerUpdate) {
    this.pending = update
    const wait = PLAYER_UPDATE_INTERVAL - (performance.now() - this.lastSentAt)
    if (wait <= 0) this.flush()
    else this.timer ??= window.setTimeout(() => this.flush(), wait)
  }

  private flush() {
    window.clearTimeout(this.timer)
    this.timer = undefined
    const update = this.pending
    this.pending = undefined
    if (!update || !this.room) return
    const last = this.lastSent
    if (
      last &&
      last.x === update.x &&
      last.y === update.y &&
      last.anim === update.anim &&
      Math.abs(last.rot - update.rot) < 0.01
    )
      return
    this.room.send(Message.UPDATE_PLAYER, update)
    this.lastSent = update
    this.lastSentAt = performance.now()
  }

  sendAvatar(avatar: Avatar) {
    this.room?.send(Message.UPDATE_PLAYER_AVATAR, { avatar: JSON.stringify(avatar) })
  }

  sendName(name: string) {
    this.room?.send(Message.UPDATE_PLAYER_NAME, { name })
  }

  sendChat(content: string) {
    this.room?.send(Message.ADD_CHAT_MESSAGE, { content })
  }

  sendEmote(emote: Emote | `drink:${Drink}`) {
    this.room?.send(Message.PLAYER_EMOTE, { emote })
  }

  connectToComputer(id: string) {
    this.room?.send(Message.CONNECT_TO_COMPUTER, { computerId: id })
  }

  disconnectFromComputer(id: string) {
    this.room?.send(Message.DISCONNECT_FROM_COMPUTER, { computerId: id })
  }

  connectToWhiteboard(id: string) {
    this.room?.send(Message.CONNECT_TO_WHITEBOARD, { whiteboardId: id })
  }

  disconnectFromWhiteboard(id: string) {
    this.room?.send(Message.DISCONNECT_FROM_WHITEBOARD, { whiteboardId: id })
  }

  addNote(message: AddNoteMessage) {
    this.room?.send(Message.WHITEBOARD_ADD_NOTE, message)
  }

  updateNote(message: UpdateNoteMessage) {
    this.room?.send(Message.WHITEBOARD_UPDATE_NOTE, message)
  }

  deleteNote(message: DeleteNoteMessage) {
    this.room?.send(Message.WHITEBOARD_DELETE_NOTE, message)
  }

  // a LiveKit token for the media room at my position or at a computer; null in quiet zones
  async requestMediaGrant(
    request: MediaTokenRequest = { kind: 'location' }
  ): Promise<MediaGrant | null> {
    if (!this.room) throw new Error('Not in a room')
    this.flush()
    return this.room.request(Message.REQUEST_MEDIA_TOKEN, request)
  }
}

export const network = new Network()
