import Phaser from 'phaser'

// import { debugDraw } from '../utils/debug'
import { createCharacterAnims } from '../anims/CharacterAnims'

import Item from '../items/Item'
import Chair from '../items/Chair'
import Computer from '../items/Computer'
import VendingMachine from '../items/VendingMachine'
import '../characters/MyPlayer'
import '../characters/OtherPlayer'
import MyPlayer from '../characters/MyPlayer'
import OtherPlayer from '../characters/OtherPlayer'
import PlayerSelector from '../characters/PlayerSelector'
import Network from '../services/Network'
import { IPlayer } from '../../../types/IOfficeState'
import { PlayerBehavior } from '../../../types/PlayerBehavior'
import { ItemType } from '../../../types/Items'
import { findZone, getProperty, parseOfficeMap, type OfficeMap } from '../../../types/OfficeMap'
import { getMediaLocation } from '../../../types/Media'
import { MEDIA_UPDATE_INTERVAL } from '@skyoffice/media'

import store from '../stores'
import { setFocused, setShowChat } from '../stores/ChatStore'
import { NavKeys, Keyboard } from '../../../types/KeyboardState'

// spritesheet keys (see Bootstrap) of the tilesets used in the Tiled map
const TILESET_TEXTURES: Record<string, string> = {
  FloorAndGround: 'tiles_wall',
  Modern_Office_Black_Shadow: 'office',
  Generic: 'generic',
  Basement: 'basement',
  Classroom_and_library: 'library',
  chair: 'chairs',
  computer: 'computers',
  vendingmachine: 'vendingmachines',
}
// object layers with their own handling, all others are decoration
const SPECIAL_LAYERS = new Set([
  'Chair',
  'Computer',
  'Whiteboard',
  'VendingMachine',
  'Spawn',
  'Zones',
])
// decoration layers of the original map that block movement; new layers use a `collides` property
const LEGACY_COLLIDING_LAYERS = new Set(['ObjectsOnCollide', 'GenericObjectsOnCollide', 'Basement'])

const PLAYER_ZOOM = 1.5
const ZOOM_IN_DURATION = 1500 // ms
// leave a small margin around the map in the overview
const OVERVIEW_PADDING = 0.95
// on big screens don't get closer than this, so joining still zooms in noticeably
const MAX_OVERVIEW_ZOOM = 1

export default class Game extends Phaser.Scene {
  network!: Network
  private cursors!: NavKeys
  private keyE!: Phaser.Input.Keyboard.Key
  private keyR!: Phaser.Input.Keyboard.Key
  private map!: Phaser.Tilemaps.Tilemap
  myPlayer!: MyPlayer
  private playerSelector!: Phaser.GameObjects.Zone
  private otherPlayers!: Phaser.Physics.Arcade.Group
  private otherPlayerMap = new Map<string, OtherPlayer>()
  computerMap = new Map<string, Computer>()
  officeMap!: OfficeMap
  private inOverview = false
  private mediaUpdateTimer = 0

  constructor() {
    super('game')
  }

  registerKeys() {
    this.cursors = {
      ...this.input.keyboard!.createCursorKeys(),
      ...(this.input.keyboard!.addKeys('W,S,A,D') as Keyboard),
    }

    // maybe we can have a dedicated method for adding keys if more keys are needed in the future
    this.keyE = this.input.keyboard!.addKey('E')
    this.keyR = this.input.keyboard!.addKey('R')
    this.input.keyboard!.disableGlobalCapture()
    this.input.keyboard!.on('keydown-ENTER', (event) => {
      store.dispatch(setShowChat(true))
      store.dispatch(setFocused(true))
    })
    this.input.keyboard!.on('keydown-ESC', (event) => {
      store.dispatch(setShowChat(false))
    })
  }

  disableKeys() {
    this.input.keyboard!.enabled = false
  }

  enableKeys() {
    this.input.keyboard!.enabled = true
  }

  // fit the whole map into the view
  showOverview() {
    const camera = this.cameras.main
    const { widthInPixels, heightInPixels } = this.map
    this.inOverview = true
    camera.stopFollow()
    const fitZoom = Math.min(camera.width / widthInPixels, camera.height / heightInPixels)
    camera.setZoom(Math.min(fitZoom * OVERVIEW_PADDING, MAX_OVERVIEW_ZOOM))
    camera.centerOn(widthInPixels / 2, heightInPixels / 2)
  }

  // fly from the overview to my player, then follow it
  zoomToPlayer() {
    if (!this.inOverview) return
    this.inOverview = false
    const camera = this.cameras.main
    camera.pan(this.myPlayer.x, this.myPlayer.y, ZOOM_IN_DURATION, 'Sine.easeInOut')
    camera.zoomTo(PLAYER_ZOOM, ZOOM_IN_DURATION, 'Sine.easeInOut', false, (_camera, progress) => {
      if (progress === 1) camera.startFollow(this.myPlayer, true)
    })
  }

  private handleResize() {
    if (this.inOverview) this.showOverview()
  }

  create(data: { network: Network }) {
    if (!data.network) {
      throw new Error('server instance missing')
    } else {
      this.network = data.network
    }

    createCharacterAnims(this.anims)

    this.map = this.make.tilemap({ key: 'tilemap' })
    const FloorAndGround = this.map.addTilesetImage('FloorAndGround', 'tiles_wall')!

    // tile layers in map order (e.g. floor under the walls, then the walls), walls collide
    const groundLayers = this.map.layers.map((layer) => {
      const tileLayer = this.map.createLayer(layer.name, FloorAndGround)!
      tileLayer.setCollisionByProperty({ collides: true })
      return tileLayer
    })

    // debugDraw(groundLayers[0], this)

    this.officeMap = parseOfficeMap(this.cache.tilemap.get('tilemap').data)
    const { spawn } = this.officeMap
    this.myPlayer = this.add.myPlayer(spawn.x, spawn.y, 'adam', this.network.mySessionId)
    this.playerSelector = new PlayerSelector(this, 0, 0, 16, 16)

    // import chair objects from Tiled map to Phaser
    const chairs = this.physics.add.staticGroup({ classType: Chair })
    this.getObjectLayer('Chair').forEach((chairObj) => {
      const item = this.addObjectFromTiled(chairs, chairObj) as Chair
      // the direction the player faces when sitting, set as custom property in Tiled
      item.itemDirection = getProperty<string>(chairObj, 'direction') ?? 'down'
    })

    // items are identified by their Tiled object id, the server uses the same ids
    const computers = this.physics.add.staticGroup({ classType: Computer })
    this.getObjectLayer('Computer').forEach((obj) => {
      const item = this.addObjectFromTiled(computers, obj) as Computer
      item.setDepth(item.y + item.height * 0.27)
      item.id = String(obj.id)
      this.computerMap.set(item.id, item)
    })

    const vendingMachines = this.physics.add.staticGroup({ classType: VendingMachine })
    this.getObjectLayer('VendingMachine').forEach((obj) => {
      this.addObjectFromTiled(vendingMachines, obj)
    })

    // every other object layer is decoration
    for (const layer of this.map.objects) {
      if (SPECIAL_LAYERS.has(layer.name)) continue
      const collides =
        getProperty<boolean>(layer, 'collides') ?? LEGACY_COLLIDING_LAYERS.has(layer.name)
      this.addGroupFromTiled(layer, collides)
    }

    this.otherPlayers = this.physics.add.group({ classType: OtherPlayer })

    // show the whole office behind the join screen, zoomToPlayer() is called on join
    this.showOverview()
    this.scale.on('resize', this.handleResize, this)
    this.events.once('shutdown', () => this.scale.off('resize', this.handleResize, this))

    this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], groundLayers)
    this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], vendingMachines)

    this.physics.add.overlap(
      this.playerSelector,
      [chairs, computers, vendingMachines],
      this.handleItemSelectorOverlap,
      undefined,
      this
    )

    // register network event listeners
    this.network.onPlayerJoined(this.handlePlayerJoined, this)
    this.network.onPlayerLeft(this.handlePlayerLeft, this)
    this.network.onPlayerUpdated(this.handlePlayerUpdated, this)
    this.network.onItemUserAdded(this.handleItemUserAdded, this)
    this.network.onItemUserRemoved(this.handleItemUserRemoved, this)
    this.network.onChatMessageAdded(this.handleChatMessageAdded, this)
  }

  private handleItemSelectorOverlap(playerSelector, selectionItem) {
    // while sitting, only the item in front can be used (e.g. a computer), not the chair of the next row
    if (this.myPlayer.playerBehavior === PlayerBehavior.SITTING && selectionItem instanceof Chair) {
      return
    }
    const currentItem = playerSelector.selectedItem as Item
    // currentItem is undefined if nothing was perviously selected
    if (currentItem) {
      // if the selection has not changed, do nothing
      if (currentItem === selectionItem || currentItem.depth >= selectionItem.depth) {
        return
      }
      // if selection changes, clear pervious dialog
      if (this.myPlayer.playerBehavior !== PlayerBehavior.SITTING) currentItem.clearDialogBox()
    }

    // set selected item and set up new dialog
    playerSelector.selectedItem = selectionItem
    selectionItem.onOverlapDialog()
  }

  private getObjectLayer(name: string) {
    return this.map.getObjectLayer(name)?.objects ?? []
  }

  // the spritesheet and frame for a Tiled object, derived from the tileset its gid belongs to
  private getTextureFrame(object: Phaser.Types.Tilemaps.TiledObject) {
    const gid = object.gid!
    let tileset = this.map.tilesets[0]
    for (const candidate of this.map.tilesets) {
      if (candidate.firstgid <= gid && candidate.firstgid >= tileset.firstgid) tileset = candidate
    }
    const texture = TILESET_TEXTURES[tileset.name]
    if (!texture) throw new Error(`No spritesheet loaded for tileset ${tileset.name}`)
    return { texture, frame: gid - tileset.firstgid }
  }

  private addObjectFromTiled(
    group: Phaser.Physics.Arcade.StaticGroup,
    object: Phaser.Types.Tilemaps.TiledObject
  ) {
    const { texture, frame } = this.getTextureFrame(object)
    // Tiled anchors objects at their bottom left corner
    const actualX = object.x! + object.width! * 0.5
    const actualY = object.y! - object.height! * 0.5
    return group.get(actualX, actualY, texture, frame).setDepth(actualY)
  }

  private addGroupFromTiled(layer: Phaser.Tilemaps.ObjectLayer, collidable: boolean) {
    const group = this.physics.add.staticGroup()
    layer.objects.forEach((object) => {
      if (object.gid) this.addObjectFromTiled(group, object)
    })
    if (this.myPlayer && collidable)
      this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], group)
  }

  // the zone (meeting room, focus booth, ...) at a position in the office
  zoneAt(x: number, y: number) {
    return findZone(this.officeMap.zones, x, y)
  }

  // function to add new player to the otherPlayer group
  private handlePlayerJoined(newPlayer: IPlayer, id: string) {
    const otherPlayer = this.add.otherPlayer(newPlayer.x, newPlayer.y, 'adam', id, newPlayer.name)
    this.otherPlayers.add(otherPlayer)
    this.otherPlayerMap.set(id, otherPlayer)
  }

  // function to remove the player who left from the otherPlayer group
  private handlePlayerLeft(id: string) {
    if (this.otherPlayerMap.has(id)) {
      const otherPlayer = this.otherPlayerMap.get(id)
      if (!otherPlayer) return
      this.otherPlayers.remove(otherPlayer, true, true)
      this.otherPlayerMap.delete(id)
    }
  }

  // function to update target position upon receiving player updates
  private handlePlayerUpdated(field: string, value: number | string, id: string) {
    const otherPlayer = this.otherPlayerMap.get(id)
    otherPlayer?.updateOtherPlayer(field, value)
  }

  private handleItemUserAdded(playerId: string, itemId: string, itemType: ItemType) {
    if (itemType === ItemType.COMPUTER) {
      const computer = this.computerMap.get(itemId)
      computer?.addCurrentUser(playerId)
    }
  }

  private handleItemUserRemoved(playerId: string, itemId: string, itemType: ItemType) {
    if (itemType === ItemType.COMPUTER) {
      const computer = this.computerMap.get(itemId)
      computer?.removeCurrentUser(playerId)
    }
  }

  private handleChatMessageAdded(playerId: string, content: string) {
    const otherPlayer = this.otherPlayerMap.get(playerId)
    otherPlayer?.updateDialogBubble(content)
  }

  update(t: number, dt: number) {
    if (this.myPlayer && this.network) {
      this.playerSelector.update(this.myPlayer, this.cursors)
      this.myPlayer.update(this.playerSelector, this.cursors, this.keyE, this.keyR, this.network)
      this.updateMediaLocation(dt)
    }
  }

  // tell the video chat where I am and who is close by
  private updateMediaLocation(dt: number) {
    this.mediaUpdateTimer -= dt
    if (this.mediaUpdateTimer > 0 || !store.getState().user.loggedIn) return
    this.mediaUpdateTimer = MEDIA_UPDATE_INTERVAL

    const { x, y } = this.myPlayer
    const distances = new Map<string, number>()
    for (const [id, otherPlayer] of this.otherPlayerMap) {
      distances.set(id, Phaser.Math.Distance.Between(x, y, otherPlayer.x, otherPlayer.y))
    }
    this.network.media?.updateLocation(getMediaLocation(this.officeMap.zones, x, y), distances)
  }
}
