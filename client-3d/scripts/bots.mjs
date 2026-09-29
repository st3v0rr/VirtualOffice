// Fills the conference room with bots for performance tests: most of them sit on the
// chairs, the rest walk around, all with random avatars, chat now and then and wave.
//
//   node client-3d/scripts/bots.mjs [count=40] [ws://localhost:2567] [seconds=120]
import fs from 'node:fs'
import path from 'node:path'
import { Client } from '@colyseus/sdk'

const count = Number(process.argv[2] ?? 40)
const endpoint = process.argv[3] ?? 'ws://localhost:2567'
const seconds = Number(process.argv[4] ?? 120)

const office = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, '..', 'src', 'map', 'office.generated.json'),
    'utf8'
  )
)
// message numbers of types/Messages.ts
const UPDATE_PLAYER = 0
const UPDATE_PLAYER_NAME = 1
const ADD_CHAT_MESSAGE = 6
const UPDATE_PLAYER_AVATAR = 14
const PLAYER_EMOTE = 15

const any = (list) => list[Math.floor(Math.random() * list.length)]
const COLORS = [
  '#ff9aa2',
  '#ffb870',
  '#ffe08a',
  '#b5e8a3',
  '#8fd3e8',
  '#9fb2ff',
  '#c9a7f5',
  '#f5f0e6',
]
const randomAvatar = () => ({
  skin: any(['#ffe3d3', '#f9d0b4', '#eab48f', '#c98d66', '#9a6446', '#6e4531']),
  hair: any(['bob', 'spiky', 'pigtails', 'bun']),
  hairColor: any(['#4a3a35', '#8a5a3c', '#e9c27d', '#d9735b', '#f4a6c0', '#9fb8f0']),
  top: any(['tshirt', 'hoodie', 'sweater']),
  topColor: any(COLORS),
  bottom: any(['pants', 'shorts', 'skirt']),
  bottomColor: any(COLORS),
  texture: any(['adam', 'ash', 'lucy', 'nancy']),
})

// the chairs of the conference room (the "auditorium" zone), in rows towards the stage
const hall = office.zones.find((z) => z.type === 'auditorium')
const inHall = (x, y) =>
  x >= hall.x * 32 && x < (hall.x + hall.w) * 32 && y >= hall.y * 32 && y < (hall.y + hall.h) * 32
const seats = office.chairs.filter((c) => inHall(c.x, c.y))
const SIT_SHIFT = { up: [0, 3], down: [0, 3], left: [0, -8], right: [0, -8] }

const client = new Client(endpoint)
const bots = []
for (let i = 0; i < count; i++) {
  const room = await client.joinOrCreate('skyoffice')
  room.onMessage('*', () => {})
  const avatar = randomAvatar()
  room.send(UPDATE_PLAYER_NAME, { name: `Bot ${i + 1}` })
  room.send(UPDATE_PLAYER_AVATAR, { avatar: JSON.stringify(avatar) })
  const seat = i < Math.min(seats.length, Math.round(count * 0.75)) ? seats[i] : null
  if (seat) {
    const [dx, dy] = SIT_SHIFT[seat.dir]
    room.send(UPDATE_PLAYER, {
      x: seat.x + dx,
      y: seat.y + dy,
      anim: `${avatar.texture}_sit_${seat.dir}`,
      rot: Math.PI,
    })
  }
  // walkers circle around the free space at the back of the hall
  bots.push({
    room,
    avatar,
    seat,
    phase: Math.random() * Math.PI * 2,
    speed: 0.6 + Math.random() * 0.5,
  })
}
console.log(`${bots.length} bots in the room (${bots.filter((b) => b.seat).length} sitting)`)

const cx = 9.5 * 32
const cy = 21 * 32
const start = Date.now()
const timer = setInterval(() => {
  const t = (Date.now() - start) / 1000
  for (const bot of bots) {
    if (!bot.seat) {
      const a = bot.phase + t * bot.speed * 0.5
      const x = cx + Math.cos(a) * 170
      const y = cy + Math.sin(a) * 40
      const rot = Math.atan2(-Math.sin(a), Math.cos(a) * 0.23)
      const dir =
        Math.abs(Math.cos(a)) > 0.5
          ? Math.sin(a) > 0
            ? 'left'
            : 'right'
          : Math.cos(a) > 0
            ? 'down'
            : 'up'
      bot.room.send(UPDATE_PLAYER, { x, y, anim: `${bot.avatar.texture}_run_${dir}`, rot })
    }
    if (Math.random() < 0.002) bot.room.send(PLAYER_EMOTE, { emote: any(['wave', 'cheer']) })
    if (Math.random() < 0.0008)
      bot.room.send(ADD_CHAT_MESSAGE, {
        content: any(['Hallo!', 'Kaffee?', 'Gleich geht’s los', '👋']),
      })
  }
  if (t > seconds) {
    clearInterval(timer)
    Promise.all(bots.map((b) => b.room.leave())).then(() => process.exit(0))
  }
}, 66)
