// Test players for the avatar editor PoC: they join the public room with random LPC avatars,
// walk around the spawn point and change their avatar now and then. One extra client only
// watches and measures how long an avatar change takes to reach it.
//
// usage: npm run bots -- [count=12] [seconds=0 (run until Ctrl+C)] [--legacy]
//   --legacy  every third bot behaves like an old client (no avatar, "ash_run_left" anims)

import { Callbacks, Client, type Room } from '@colyseus/sdk'
import { Message } from '../types/Messages.ts'
import { RoomType } from '../types/Rooms.ts'
import { randomAvatar, serializeAvatar } from '../types/Avatar.ts'

const args = process.argv.slice(2)
const legacy = args.includes('--legacy')
const [count = 12, seconds = 0] = args.filter((arg) => !arg.startsWith('--')).map(Number)
const endpoint = process.env.SERVER_URL ?? 'ws://localhost:2567'

const TICK = 66 // ms, like the client
const SPEED = 200 // px/s
const WANDER_RADIUS = 120
const AVATAR_CHANGE_INTERVAL = [5000, 15000] // ms

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const between = ([min, max]: number[]) => min + Math.random() * (max - min)

// avatar string -> when a bot sent it, to measure the latency at the observer
const sentAt = new Map<string, number>()
const latencies: number[] = []

// room data, chat etc. are of no interest here
function ignoreMessages(room: Room) {
  room.onMessage('*', () => {})
}

async function observe() {
  const room = await new Client(endpoint).joinOrCreate(RoomType.PUBLIC)
  ignoreMessages(room)
  const $ = Callbacks.get(room)
  $.onAdd('players', (player: any) => {
    $.listen(player, 'avatar', (avatar: string) => {
      const sent = sentAt.get(avatar)
      if (sent === undefined) return
      sentAt.delete(avatar)
      latencies.push(performance.now() - sent)
    })
  })
  return room
}

async function bot(index: number) {
  const isLegacy = legacy && index % 3 === 2
  const room: Room = await new Client(endpoint).joinOrCreate(RoomType.PUBLIC)
  ignoreMessages(room)
  await sleep(200)
  const me = (room.state as any).players.get(room.sessionId)
  const spawn = { x: me?.x ?? 705, y: me?.y ?? 500 }
  let { x, y } = spawn
  let target = { ...spawn }
  let texture = 'ash'

  const changeAvatar = () => {
    // a unique string per change (the same avatar again would not be synced)
    let avatar: string
    do avatar = serializeAvatar(randomAvatar())
    while (avatar === me?.avatar || sentAt.has(avatar))
    sentAt.set(avatar, performance.now())
    room.send(Message.UPDATE_PLAYER_AVATAR, { avatar })
    // the anim key only carries state and direction for LPC avatars
    texture = 'lpc-bot'
  }

  room.send(Message.UPDATE_PLAYER_NAME, { name: `Bot ${index + 1}${isLegacy ? ' (alt)' : ''}` })
  if (!isLegacy) changeAvatar()

  let nextAvatarChange = performance.now() + between(AVATAR_CHANGE_INTERVAL)
  const timer = setInterval(() => {
    const dx = target.x - x
    const dy = target.y - y
    const distance = Math.hypot(dx, dy)
    const step = (SPEED * TICK) / 1000
    let anim: string
    if (distance < step) {
      x = target.x
      y = target.y
      anim = 'idle_down'
      if (Math.random() < 0.05) {
        target = {
          x: spawn.x + (Math.random() - 0.5) * 2 * WANDER_RADIUS,
          y: spawn.y + (Math.random() - 0.5) * 2 * WANDER_RADIUS,
        }
      }
    } else {
      x += (dx / distance) * step
      y += (dy / distance) * step
      const direction =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      anim = `run_${direction}`
    }
    room.send(Message.UPDATE_PLAYER, { x, y, anim: `${texture}_${anim}` })

    if (!isLegacy && performance.now() > nextAvatarChange) {
      changeAvatar()
      nextAvatarChange = performance.now() + between(AVATAR_CHANGE_INTERVAL)
    }
  }, TICK)

  return () => {
    clearInterval(timer)
    return room.leave()
  }
}

function report() {
  if (latencies.length === 0) return console.log('no avatar changes observed yet')
  const sorted = [...latencies].sort((a, b) => a - b)
  const percentile = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
  const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
  console.log(
    `avatar changes seen by the observer: ${sorted.length}, latency avg ${average.toFixed(1)} ms, ` +
      `p50 ${percentile(0.5).toFixed(1)} ms, p95 ${percentile(0.95).toFixed(1)} ms, ` +
      `max ${sorted[sorted.length - 1].toFixed(1)} ms`
  )
}

const observer = await observe()
const stops = []
for (let i = 0; i < count; i++) {
  stops.push(await bot(i))
  await sleep(100)
}
console.log(`${count} bots in the public room${legacy ? ' (every third without avatar)' : ''}`)

const reportTimer = setInterval(report, 10000)
const stop = async () => {
  clearInterval(reportTimer)
  report()
  await Promise.all(stops.map((stopBot) => stopBot()))
  await observer.leave()
  process.exit(0)
}
process.on('SIGINT', stop)
if (seconds > 0) setTimeout(stop, seconds * 1000)
