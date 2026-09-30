import { beforeEach, describe, expect, it } from 'vitest'
import { Dispatcher } from '@colyseus/command'
import type { Client } from 'colyseus'
import { OfficeState, Player, Computer } from '../rooms/schema/OfficeState.ts'
import type { SkyOffice } from '../rooms/SkyOffice.ts'
import PlayerUpdateAvatarCommand from '../rooms/commands/PlayerUpdateAvatarCommand.ts'
import PlayerUpdateCommand from '../rooms/commands/PlayerUpdateCommand.ts'
import PlayerUpdateNameCommand from '../rooms/commands/PlayerUpdateNameCommand.ts'
import ChatMessageUpdateCommand from '../rooms/commands/ChatMessageUpdateCommand.ts'
import {
  ComputerAddUserCommand,
  ComputerRemoveUserCommand,
} from '../rooms/commands/ComputerUpdateArrayCommand.ts'

// the commands only touch room.state, so a room with a real OfficeState is enough
let state: OfficeState
let dispatcher: Dispatcher<SkyOffice>
const client = (sessionId: string) => ({ sessionId }) as Client
const alice = client('alice')

beforeEach(() => {
  state = new OfficeState()
  state.players.set('alice', new Player())
  state.computers.set('7', new Computer())
  dispatcher = new Dispatcher({ state } as unknown as SkyOffice)
})

describe('PlayerUpdateAvatarCommand', () => {
  it('stores a valid avatar', () => {
    const avatar = JSON.stringify({ hair: 'bob', skin: '#ffe3d3' })
    dispatcher.dispatch(new PlayerUpdateAvatarCommand(), { client: alice, avatar })
    expect(state.players.get('alice')!.avatar).toBe(avatar)
  })

  it('keeps the old avatar when the new one is invalid', () => {
    state.players.get('alice')!.avatar = '{"hair":"bun"}'
    for (const avatar of ['nope', '[]', 42, 'x'.repeat(2000)]) {
      dispatcher.dispatch(new PlayerUpdateAvatarCommand(), { client: alice, avatar })
    }
    expect(state.players.get('alice')!.avatar).toBe('{"hair":"bun"}')
  })

  it('ignores unknown players', () => {
    dispatcher.dispatch(new PlayerUpdateAvatarCommand(), { client: client('ghost'), avatar: '{}' })
    expect(state.players.has('ghost')).toBe(false)
  })
})

describe('PlayerUpdateCommand', () => {
  it('moves the player', () => {
    dispatcher.dispatch(new PlayerUpdateCommand(), {
      client: alice,
      x: 100,
      y: 200,
      anim: 'lucy_run_up',
      rot: 3.14,
    })
    const player = state.players.get('alice')!
    expect([player.x, player.y, player.anim, player.rot]).toEqual([100, 200, 'lucy_run_up', 3.14])
  })

  it('ignores broken positions instead of storing NaN', () => {
    const player = state.players.get('alice')!
    const before = [player.x, player.y, player.anim]
    dispatcher.dispatch(new PlayerUpdateCommand(), { client: alice, x: NaN, y: 1, anim: 'a' })
    dispatcher.dispatch(new PlayerUpdateCommand(), { client: alice, x: 1, y: 1, anim: 5 })
    expect([player.x, player.y, player.anim]).toEqual(before)
  })
})

describe('PlayerUpdateNameCommand', () => {
  it('stores the trimmed name', () => {
    dispatcher.dispatch(new PlayerUpdateNameCommand(), { client: alice, name: '  Alice ' })
    expect(state.players.get('alice')!.name).toBe('Alice')
  })
})

describe('ChatMessageUpdateCommand', () => {
  it('stores the message with the author', () => {
    state.players.get('alice')!.name = 'Alice'
    dispatcher.dispatch(new ChatMessageUpdateCommand(), { client: alice, content: 'Hallo' })
    expect(state.chatMessages.map((m) => [m.author, m.content])).toEqual([['Alice', 'Hallo']])
  })

  it('keeps only the last 100 messages', () => {
    for (let i = 0; i < 105; i++) {
      dispatcher.dispatch(new ChatMessageUpdateCommand(), { client: alice, content: `m${i}` })
    }
    expect(state.chatMessages.length).toBe(100)
    expect(state.chatMessages[0].content).toBe('m5')
    expect(state.chatMessages[99].content).toBe('m104')
  })

  it('ignores messages of players that already left', () => {
    dispatcher.dispatch(new ChatMessageUpdateCommand(), { client: client('ghost'), content: 'x' })
    expect(state.chatMessages.length).toBe(0)
  })
})

describe('computer users', () => {
  it('adds and removes a user once', () => {
    const users = () => [...state.computers.get('7')!.connectedUser.values()]
    dispatcher.dispatch(new ComputerAddUserCommand(), { client: alice, computerId: '7' })
    dispatcher.dispatch(new ComputerAddUserCommand(), { client: alice, computerId: '7' })
    expect(users()).toEqual(['alice'])
    dispatcher.dispatch(new ComputerRemoveUserCommand(), { client: alice, computerId: '7' })
    expect(users()).toEqual([])
  })

  it('ignores unknown computers instead of throwing', () => {
    expect(() =>
      dispatcher.dispatch(new ComputerAddUserCommand(), { client: alice, computerId: 'nope' })
    ).not.toThrow()
    expect(() =>
      dispatcher.dispatch(new ComputerRemoveUserCommand(), { client: alice, computerId: 'nope' })
    ).not.toThrow()
  })
})
