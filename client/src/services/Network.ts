import { Callbacks, Client, type Room } from '@colyseus/sdk'
import type { IOfficeState, IPlayer } from '../../../types/IOfficeState'
import { Message } from '../../../types/Messages'
import { type IRoomData, RoomType } from '../../../types/Rooms'
import { ItemType } from '../../../types/Items'
import MediaManager from '../web/MediaManager'
import type { MediaGrant, MediaTokenRequest } from '../../../types/Media'
import { phaserEvents, Event } from '../events/EventCenter'
import { serializeAvatar, type AvatarDescription } from '../../../types/Avatar'
import store from '../stores'
import { setSessionId, setPlayerNameMap, removePlayerNameMap } from '../stores/UserStore'
import {
  setLobbyJoined,
  setJoinedRoomData,
  setAvailableRooms,
  addAvailableRooms,
  removeAvailableRooms,
} from '../stores/RoomStore'
import {
  pushChatMessage,
  pushPlayerJoinedMessage,
  pushPlayerLeftMessage,
} from '../stores/ChatStore'
import { removeArrow, removeNote, upsertArrow, upsertNote } from '../stores/WhiteboardStore'
import type {
  AddArrowMessage,
  AddNoteMessage,
  DeleteArrowMessage,
  DeleteNoteMessage,
  HandleSide,
  NoteColor,
  UpdateNoteMessage,
} from '../../../types/Whiteboard'

// how often my position is sent while moving (15 times per second)
const PLAYER_UPDATE_INTERVAL = 66 // ms

type PlayerUpdate = { x: number; y: number; anim: string }

// player fields which are forwarded to the game scene whenever they change
// (avatar before anim, so a joining player is drawn with the right character straight away)
const PLAYER_FIELDS = ['name', 'x', 'y', 'avatar', 'anim'] as const

export default class Network {
  private client: Client
  private room?: Room<any, IOfficeState>
  private lobby!: Room
  media?: MediaManager

  mySessionId!: string

  private pendingPlayerUpdate?: PlayerUpdate
  private lastSentPlayerUpdate?: PlayerUpdate
  private lastPlayerUpdateTime = 0
  private playerUpdateTimer?: number
  // when my last avatar change was sent, to log how long the server takes to sync it back
  private avatarSentAt = new Map<string, number>()

  constructor() {
    const protocol = window.location.protocol.replace('http', 'ws')
    const endpoint = import.meta.env.PROD
      ? import.meta.env.VITE_SERVER_URL
      : `${protocol}//${window.location.hostname}:2567`
    this.client = new Client(endpoint)
    this.joinLobbyRoom().then(() => {
      store.dispatch(setLobbyJoined(true))
    })

    phaserEvents.on(Event.MY_PLAYER_NAME_CHANGE, this.updatePlayerName, this)
    phaserEvents.on(Event.MY_PLAYER_TEXTURE_CHANGE, this.updatePlayer, this)
    phaserEvents.on(Event.MY_PLAYER_AVATAR_CHANGE, this.updatePlayerAvatar, this)
  }

  /**
   * method to join Colyseus' built-in LobbyRoom, which automatically notifies
   * connected clients whenever rooms with "realtime listing" have updates
   */
  async joinLobbyRoom() {
    this.lobby = await this.client.joinOrCreate(RoomType.LOBBY)

    this.lobby.onMessage('rooms', (rooms) => {
      store.dispatch(setAvailableRooms(rooms))
    })

    this.lobby.onMessage('+', ([roomId, room]) => {
      store.dispatch(addAvailableRooms({ roomId, room }))
    })

    this.lobby.onMessage('-', (roomId) => {
      store.dispatch(removeAvailableRooms(roomId))
    })
  }

  // method to join the public lobby
  async joinOrCreatePublic() {
    this.room = await this.client.joinOrCreate(RoomType.PUBLIC)
    this.initialize()
  }

  // method to join a custom room
  async joinCustomById(roomId: string, password: string | null) {
    this.room = await this.client.joinById(roomId, { password })
    this.initialize()
  }

  // method to create a custom room
  async createCustom(roomData: IRoomData) {
    const { name, description, password, autoDispose } = roomData
    this.room = await this.client.create(RoomType.CUSTOM, {
      name,
      description,
      password,
      autoDispose,
    })
    this.initialize()
  }

  // set up all network listeners before the game starts
  initialize() {
    if (!this.room) return

    this.lobby.leave()
    this.mySessionId = this.room.sessionId
    store.dispatch(setSessionId(this.room.sessionId))
    this.media = new MediaManager(this, this.mySessionId)

    const $ = Callbacks.get(this.room)

    // new instance added to the players MapSchema
    $.onAdd('players', (player, key) => {
      if (key === this.mySessionId) {
        $.listen(player, 'avatar', (value) => this.logAvatarRoundTrip(value))
        return
      }

      // track changes on every field of the child object inside the players MapSchema
      PLAYER_FIELDS.forEach((field) => {
        $.listen(player, field, (value, previousValue) => {
          // when a new player finished setting up player name
          if (field === 'name' && value !== '' && !previousValue) {
            phaserEvents.emit(Event.PLAYER_JOINED, player, key)
            store.dispatch(pushPlayerJoinedMessage(value as string))
          }
          if (field === 'name' && value !== '') {
            store.dispatch(setPlayerNameMap({ id: key, name: value as string }))
          }

          phaserEvents.emit(Event.PLAYER_UPDATED, field, value, key)
        })
      })
    })

    // an instance removed from the players MapSchema
    $.onRemove('players', (player, key) => {
      phaserEvents.emit(Event.PLAYER_LEFT, key)
      store.dispatch(pushPlayerLeftMessage(player.name))
      store.dispatch(removePlayerNameMap(key))
    })

    // new instance added to the computers MapSchema
    $.onAdd('computers', (computer, key) => {
      // track changes on every child object's connectedUser
      $.onAdd(computer, 'connectedUser', (item) => {
        phaserEvents.emit(Event.ITEM_USER_ADDED, item, key, ItemType.COMPUTER)
      })
      $.onRemove(computer, 'connectedUser', (item) => {
        phaserEvents.emit(Event.ITEM_USER_REMOVED, item, key, ItemType.COMPUTER)
      })
    })

    // new instance added to the whiteboards MapSchema
    $.onAdd('whiteboards', (whiteboard, key) => {
      // mirror the sticky notes and arrows into redux for the whiteboard dialog
      $.onAdd(whiteboard, 'notes', (note, noteId) => {
        const sync = () =>
          store.dispatch(
            upsertNote({
              whiteboardId: key,
              note: {
                id: noteId,
                x: note.x,
                y: note.y,
                width: note.width,
                height: note.height,
                text: note.text,
                color: note.color as NoteColor,
                author: note.author,
              },
            })
          )
        sync()
        $.onChange(note, sync)
      })
      $.onRemove(whiteboard, 'notes', (_note, noteId) => {
        store.dispatch(removeNote({ whiteboardId: key, noteId }))
      })
      $.onAdd(whiteboard, 'arrows', (arrow, arrowId) => {
        store.dispatch(
          upsertArrow({
            whiteboardId: key,
            arrow: {
              id: arrowId,
              from: arrow.from,
              to: arrow.to,
              fromSide: arrow.fromSide as HandleSide,
              toSide: arrow.toSide as HandleSide,
            },
          })
        )
      })
      $.onRemove(whiteboard, 'arrows', (_arrow, arrowId) => {
        store.dispatch(removeArrow({ whiteboardId: key, arrowId }))
      })

      // track changes on every child object's connectedUser
      $.onAdd(whiteboard, 'connectedUser', (item) => {
        phaserEvents.emit(Event.ITEM_USER_ADDED, item, key, ItemType.WHITEBOARD)
      })
      $.onRemove(whiteboard, 'connectedUser', (item) => {
        phaserEvents.emit(Event.ITEM_USER_REMOVED, item, key, ItemType.WHITEBOARD)
      })
    })

    // new instance added to the chatMessages ArraySchema
    $.onAdd('chatMessages', ({ author, createdAt, content }) => {
      store.dispatch(pushChatMessage({ author, createdAt, content }))
    })

    // when the server sends room data
    this.room.onMessage(Message.SEND_ROOM_DATA, (content) => {
      store.dispatch(setJoinedRoomData(content))
    })

    // when a user sends a message
    this.room.onMessage(Message.ADD_CHAT_MESSAGE, ({ clientId, content }) => {
      phaserEvents.emit(Event.UPDATE_DIALOG_BUBBLE, clientId, content)
    })
  }

  // method to register event listener and call back function when a item user added
  onChatMessageAdded(callback: (playerId: string, content: string) => void, context?: any) {
    phaserEvents.on(Event.UPDATE_DIALOG_BUBBLE, callback, context)
  }

  // method to register event listener and call back function when a item user added
  onItemUserAdded(
    callback: (playerId: string, key: string, itemType: ItemType) => void,
    context?: any
  ) {
    phaserEvents.on(Event.ITEM_USER_ADDED, callback, context)
  }

  // method to register event listener and call back function when a item user removed
  onItemUserRemoved(
    callback: (playerId: string, key: string, itemType: ItemType) => void,
    context?: any
  ) {
    phaserEvents.on(Event.ITEM_USER_REMOVED, callback, context)
  }

  // method to register event listener and call back function when a player joined
  onPlayerJoined(callback: (Player: IPlayer, key: string) => void, context?: any) {
    phaserEvents.on(Event.PLAYER_JOINED, callback, context)
  }

  // method to register event listener and call back function when a player left
  onPlayerLeft(callback: (key: string) => void, context?: any) {
    phaserEvents.on(Event.PLAYER_LEFT, callback, context)
  }

  // method to register event listener and call back function when a player updated
  onPlayerUpdated(
    callback: (field: string, value: number | string, key: string) => void,
    context?: any
  ) {
    phaserEvents.on(Event.PLAYER_UPDATED, callback, context)
  }

  // method to send player updates to Colyseus server, at most every PLAYER_UPDATE_INTERVAL
  // (the other clients move players smoothly towards the received positions)
  updatePlayer(currentX: number, currentY: number, currentAnim: string) {
    this.pendingPlayerUpdate = { x: currentX, y: currentY, anim: currentAnim }
    const wait = PLAYER_UPDATE_INTERVAL - (performance.now() - this.lastPlayerUpdateTime)
    if (wait <= 0) this.flushPlayerUpdate()
    else this.playerUpdateTimer ??= window.setTimeout(() => this.flushPlayerUpdate(), wait)
  }

  private flushPlayerUpdate() {
    window.clearTimeout(this.playerUpdateTimer)
    this.playerUpdateTimer = undefined
    const update = this.pendingPlayerUpdate
    this.pendingPlayerUpdate = undefined
    if (!update) return

    const last = this.lastSentPlayerUpdate
    if (last && last.x === update.x && last.y === update.y && last.anim === update.anim) return
    this.room?.send(Message.UPDATE_PLAYER, update)
    this.lastSentPlayerUpdate = update
    this.lastPlayerUpdateTime = performance.now()
  }

  // send my latest position right away, e.g. before asking for the media room at my position
  sendPositionNow() {
    this.flushPlayerUpdate()
  }

  // a LiveKit token for the media room at my position or at the computer I'm using
  requestMediaGrant(request: MediaTokenRequest): Promise<MediaGrant | null> {
    if (!this.room) return Promise.reject(new Error('Not in a room'))
    // messages are processed in order, so the server knows my current position
    this.sendPositionNow()
    return this.room.request(Message.REQUEST_MEDIA_TOKEN, request)
  }

  // the avatar is sent on its own, it rarely changes (the server validates it)
  updatePlayerAvatar(avatar: AvatarDescription) {
    const serialized = serializeAvatar(avatar)
    this.avatarSentAt.set(serialized, performance.now())
    this.room?.send(Message.UPDATE_PLAYER_AVATAR, { avatar: serialized })
  }

  private logAvatarRoundTrip(avatar: string) {
    const sentAt = this.avatarSentAt.get(avatar)
    if (sentAt === undefined) return
    this.avatarSentAt.delete(avatar)
    const ms = performance.now() - sentAt
    console.log(`[avatar] ${avatar} synced back by the server after ${ms.toFixed(1)} ms`)
  }

  // method to send player name to Colyseus server
  updatePlayerName(currentName: string) {
    this.room?.send(Message.UPDATE_PLAYER_NAME, { name: currentName })
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

  addWhiteboardNote(message: AddNoteMessage) {
    this.room?.send(Message.WHITEBOARD_ADD_NOTE, message)
  }

  updateWhiteboardNote(message: UpdateNoteMessage) {
    this.room?.send(Message.WHITEBOARD_UPDATE_NOTE, message)
  }

  deleteWhiteboardNote(message: DeleteNoteMessage) {
    this.room?.send(Message.WHITEBOARD_DELETE_NOTE, message)
  }

  addWhiteboardArrow(message: AddArrowMessage) {
    this.room?.send(Message.WHITEBOARD_ADD_ARROW, message)
  }

  deleteWhiteboardArrow(message: DeleteArrowMessage) {
    this.room?.send(Message.WHITEBOARD_DELETE_ARROW, message)
  }

  addChatMessage(content: string) {
    this.room?.send(Message.ADD_CHAT_MESSAGE, { content: content })
  }
}
