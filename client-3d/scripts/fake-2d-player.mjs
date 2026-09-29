// Joins the public room like the Phaser client does (name, x/y in map pixels and an
// anim like "lucy_run_left", no avatar/rot) and walks back and forth, so the 3D client
// can be checked against a "2D player" without a browser. Also prints what it sees of
// the other players, to check that 3D players send valid 2D anims.
//
//   node client-3d/scripts/fake-2d-player.mjs [ws://localhost:2567] [seconds]
import { Client, Callbacks } from '@colyseus/sdk'

const endpoint = process.argv[2] ?? 'ws://localhost:2567'
const seconds = Number(process.argv[3] ?? 20)
// message numbers of types/Messages.ts
const UPDATE_PLAYER = 0
const UPDATE_PLAYER_NAME = 1
const ADD_CHAT_MESSAGE = 6

const room = await new Client(endpoint).joinOrCreate('skyoffice')
room.send(UPDATE_PLAYER_NAME, { name: 'Lucy2D' })
const $ = Callbacks.get(room)
$.onAdd('players', (player, id) => {
  if (id === room.sessionId) return
  $.listen(player, 'anim', (anim) =>
    console.log(
      `sees ${player.name || id}: anim=${anim} x=${player.x} y=${player.y} avatar=${player.avatar ? 'yes' : 'no'}`
    )
  )
})

// walk left and right in the corridor next to the spawn
let x = 1100
let dir = -1
const start = Date.now()
const timer = setInterval(() => {
  x += dir * 13
  if (x < 900 || x > 1150) dir = -dir
  room.send(UPDATE_PLAYER, { x, y: 440, anim: `lucy_run_${dir < 0 ? 'left' : 'right'}` })
  if (Date.now() - start > seconds * 1000) {
    clearInterval(timer)
    room.send(UPDATE_PLAYER, { x, y: 440, anim: 'lucy_idle_down' })
    room.send(ADD_CHAT_MESSAGE, { content: 'Tschüss aus 2D!' })
    setTimeout(() => room.leave().then(() => process.exit(0)), 500)
  }
}, 66)
