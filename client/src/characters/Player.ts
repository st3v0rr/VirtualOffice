import Phaser from 'phaser'
import { PlayerBehavior } from '../../../types/PlayerBehavior'
import { isAvatarTexture } from '../avatar/composeAvatar'
import { FEET_Y, ORIGIN_Y } from '../avatar/lpcLayout'
/**
 * shifting distance for sitting animation
 * format: direction: [xShift, yShift, depthShift]
 */
export const sittingShiftData = {
  up: [0, 3, -10],
  down: [0, 3, 1],
  left: [0, -8, 10],
  right: [0, -8, 10],
}

// the collision box at the feet, the same size for the old 32x48 and the new 64x64 (LPC) frames
const FOOTPRINT_WIDTH = 16
const FOOTPRINT_HEIGHT = 9.6
// the frame size of the old characters, the name container body is still based on it
const LEGACY_WIDTH = 32
const LEGACY_HEIGHT = 48

export default class Player extends Phaser.Physics.Arcade.Sprite {
  playerId: string
  playerTexture: string
  playerBehavior = PlayerBehavior.IDLE
  playerName: Phaser.GameObjects.Text
  playerContainer: Phaser.GameObjects.Container
  private playerDialogBubble: Phaser.GameObjects.Container
  private timeoutID?: number

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    id: string,
    frame?: string | number
  ) {
    super(scene, x, y, texture, frame)

    this.playerId = id
    this.playerTexture = texture
    this.setDepth(this.y)

    this.anims.play(`${this.playerTexture}_idle_down`, true)
    this.updateFootprint()

    this.playerContainer = this.scene.add.container(this.x, this.y - 30).setDepth(5000)

    // add dialogBubble to playerContainer
    this.playerDialogBubble = this.scene.add.container(0, 0).setDepth(5000)
    this.playerContainer.add(this.playerDialogBubble)

    // add playerName to playerContainer
    this.playerName = this.scene.add
      .text(0, 0, '')
      .setFontFamily('Arial')
      .setFontSize(12)
      .setColor('#000000')
      .setOrigin(0.5)
    this.playerContainer.add(this.playerName)

    this.scene.physics.world.enable(this.playerContainer)
    const playContainerBody = this.playerContainer.body as Phaser.Physics.Arcade.Body
    const collisionScale = [0.5, 0.2]
    playContainerBody
      .setSize(LEGACY_WIDTH * collisionScale[0], LEGACY_HEIGHT * collisionScale[1])
      .setOffset(-8, LEGACY_HEIGHT * (1 - collisionScale[1]) + 6)
  }

  /**
   * Line the frames up so the feet are at the same place for all characters and put the
   * collision box there. Called again whenever the texture changes between old and LPC frames.
   */
  updateFootprint() {
    const lpc = isAvatarTexture(this.playerTexture)
    this.setOrigin(0.5, lpc ? ORIGIN_Y : 0.5)
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (!body) return
    const feetY = lpc ? FEET_Y : this.height
    body
      .setSize(FOOTPRINT_WIDTH, FOOTPRINT_HEIGHT, false)
      .setOffset((this.width - FOOTPRINT_WIDTH) / 2, feetY - FOOTPRINT_HEIGHT)
  }

  /** switch to another character texture, keeping the animation state and direction */
  protected changeTexture(texture: string) {
    this.playerTexture = texture
    const currentAnim = this.anims.currentAnim?.key
    const animState = currentAnim
      ? currentAnim.substring(currentAnim.indexOf('_') + 1)
      : 'idle_down'
    this.anims.play(`${this.playerTexture}_${animState}`, true)
    this.updateFootprint()
  }

  updateDialogBubble(content: string) {
    this.clearDialogBubble()

    // preprocessing for dialog bubble text (maximum 70 characters)
    const dialogBubbleText = content.length <= 70 ? content : content.substring(0, 70).concat('...')

    const innerText = this.scene.add
      .text(0, 0, dialogBubbleText, { wordWrap: { width: 165, useAdvancedWrap: true } })
      .setFontFamily('Arial')
      .setFontSize(12)
      .setColor('#000000')
      .setOrigin(0.5)

    // set dialogBox slightly larger than the text in it
    const innerTextHeight = innerText.height
    const innerTextWidth = innerText.width

    innerText.setY(-innerTextHeight / 2 - this.playerName.height / 2)
    const dialogBoxWidth = innerTextWidth + 10
    const dialogBoxHeight = innerTextHeight + 3
    const dialogBoxX = innerText.x - innerTextWidth / 2 - 5
    const dialogBoxY = innerText.y - innerTextHeight / 2 - 2

    this.playerDialogBubble.add(
      this.scene.add
        .graphics()
        .fillStyle(0xffffff, 1)
        .fillRoundedRect(dialogBoxX, dialogBoxY, dialogBoxWidth, dialogBoxHeight, 3)
        .lineStyle(1, 0x000000, 1)
        .strokeRoundedRect(dialogBoxX, dialogBoxY, dialogBoxWidth, dialogBoxHeight, 3)
    )
    this.playerDialogBubble.add(innerText)

    // After 6 seconds, clear the dialog bubble
    this.timeoutID = window.setTimeout(() => {
      this.clearDialogBubble()
    }, 6000)
  }

  private clearDialogBubble() {
    clearTimeout(this.timeoutID)
    this.playerDialogBubble.removeAll(true)
  }
}
