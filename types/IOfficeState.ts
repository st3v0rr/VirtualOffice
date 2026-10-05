import { Schema, ArraySchema, SetSchema, MapSchema } from '@colyseus/schema'

export interface IPlayer extends Schema {
  name: string
  x: number
  y: number
  anim: string
  // the avatar as JSON (see client-3d/src/avatar/avatar.ts) and the facing angle in radians
  avatar: string
  rot: number
  // the hand is up (to say something) until the player lowers it again
  handRaised: boolean
}

export interface IComputer extends Schema {
  connectedUser: SetSchema<string>
}

export interface IChatMessage extends Schema {
  author: string
  createdAt: number
  content: string
}

export interface IOfficeState extends Schema {
  players: MapSchema<IPlayer>
  computers: MapSchema<IComputer>
  chatMessages: ArraySchema<IChatMessage>
}
