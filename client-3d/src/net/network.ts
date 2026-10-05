import { Callbacks, Client, type Room } from '@colyseus/sdk'
import type { IOfficeState, IPlayer } from '../../../types/IOfficeState'
import { Message } from '../../../types/Messages'
import { RoomType } from '../../../types/Rooms'
import type { MediaGrant, MediaTokenRequest } from '../../../types/Media'
import { avatarForTexture, parseAvatar, type Avatar } from '../avatar/avatar'
import { DRINKS, EMOTES, type Drink, type Emote } from '../avatar/motion'
import { toWorld } from '../map/office'
import { useGame, pushChat, setHandUp, showBubble, showEffect, type LobbyRoom } from '../state/game'
import { me, remotes, parseAnim, DIRECTION_ANGLE } from './players'
import { serverEndpoint } from './endpoint'

// how often my position is sent while moving, same as the 2D client (15 per second)
const PLAYER_UPDATE_INTERVAL = 66

type PlayerUpdate = { x: number; y: number; anim: string; rot: number }

export type RoomTarget =
  | { kind: 'public' }
  | { kind: 'custom'; roomId: string; password?: string }
  | { kind: 'create'; name: string; description: string; password?: string }

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

  private lobby?: Room

  // the list of custom rooms, kept up to date by Colyseus' lobby room
  async joinLobby() {
    const game = useGame.getState()
    if (this.lobby || game.lobby === 'loading') return
    game.set({ lobby: 'loading' })
    try {
      const lobby = await this.client.joinOrCreate(RoomType.LOBBY)
      this.lobby = lobby
      const set = (rooms: LobbyRoom[]) => useGame.getState().set({ rooms, lobby: 'ready' })
      const toRoom = (roomId: string, room: any): LobbyRoom => ({
        roomId,
        name: room.metadata?.name ?? roomId,
        description: room.metadata?.description ?? '',
        hasPassword: !!room.metadata?.hasPassword,
        clients: room.clients ?? 0,
      })
      lobby.onMessage('rooms', (rooms: any[]) => set(rooms.map((r) => toRoom(r.roomId, r))))
      lobby.onMessage('+', ([roomId, room]: [string, any]) =>
        set([...useGame.getState().rooms.filter((r) => r.roomId !== roomId), toRoom(roomId, room)])
      )
      lobby.onMessage('-', (roomId: string) =>
        set(useGame.getState().rooms.filter((r) => r.roomId !== roomId))
      )
    } catch (error) {
      console.warn('Lobby not available', error)
      useGame.getState().set({ lobby: 'error' })
    }
  }

  async join(
    name: string,
    avatar: Avatar,
    spawn: { x: number; y: number; anim: string },
    target: RoomTarget = { kind: 'public' }
  ) {
    const game = useGame.getState()
    game.set({ connection: 'connecting', connectionError: undefined })
    try {
      if (target.kind === 'custom') {
        this.room = await this.client.joinById(target.roomId, { password: target.password || null })
      } else if (target.kind === 'create') {
        this.room = await this.client.create(RoomType.CUSTOM, {
          name: target.name,
          description: target.description,
          password: target.password || null,
          autoDispose: true,
        })
      } else {
        this.room = await this.client.joinOrCreate(RoomType.PUBLIC)
      }
    } catch (error) {
      console.error(error)
      const message = (error as Error)?.message
      game.set({
        connection: 'error',
        connectionError:
          target.kind === 'public'
            ? `Server nicht erreichbar (${serverEndpoint()}).`
            : `Beitreten fehlgeschlagen: ${message || 'unbekannter Fehler'}`,
      })
      return false
    }
    this.lobby?.leave()
    this.lobby = undefined
    const room = this.room
    // a new room: my hand starts down, like everybody's
    me.motion.handRaised = false
    game.set({
      connection: 'connected',
      sessionId: room.sessionId,
      lobby: 'idle',
      handsUp: {},
      effects: {},
    })
    this.listen(room)

    room.send(Message.UPDATE_PLAYER_NAME, { name })
    this.sendAvatar(avatar)
    this.sendPlayer({ ...spawn, rot: 0 })
    pushChat({ author: name, content: 'ist beigetreten', createdAt: Date.now(), system: true })

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
        handRaised: false,
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
      // the current value comes right away, so a hand raised before I joined shows too
      $.listen(player, 'handRaised', (raised: boolean) => {
        const remote = remotes.get(id)
        if (remote) remote.handRaised = !!raised
        setHandUp(id, !!raised)
      })
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
      setHandUp(id, false)
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
          remote.emote = 'gulp'
        } else if (EMOTES.includes(kind as Emote)) {
          remote.emote = kind as Emote
          showEffect(clientId, kind as Emote)
        }
      }
    )

    // who is using which computer
    $.onAdd('computers', (item: any, itemId: string) => {
      const update = () => {
        const users = Array.from(item.connectedUser.values()) as string[]
        useGame.getState().set({ itemUsers: { ...useGame.getState().itemUsers, [itemId]: users } })
      }
      $.onAdd(item, 'connectedUser', update)
      $.onRemove(item, 'connectedUser', update)
    })

    room.onMessage(Message.SEND_ROOM_DATA, (data: { name: string }) => {
      useGame.getState().set({ roomName: data.name })
    })
  }

  // my position as the server knows it (or is about to), in map pixels
  get position(): { x: number; y: number } | undefined {
    return this.pending ?? this.lastSent
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

  sendHand(raised: boolean) {
    this.room?.send(Message.PLAYER_HAND, { raised })
  }

  connectToComputer(id: string) {
    this.room?.send(Message.CONNECT_TO_COMPUTER, { computerId: id })
  }

  disconnectFromComputer(id: string) {
    this.room?.send(Message.DISCONNECT_FROM_COMPUTER, { computerId: id })
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
