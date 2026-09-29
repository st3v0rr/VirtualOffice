import { Schema, ArraySchema, SetSchema, MapSchema } from '@colyseus/schema'

export interface IPlayer extends Schema {
  name: string
  x: number
  y: number
  anim: string
  // added for the 3D client, the 2D client ignores them:
  // the avatar as JSON (see client-3d/src/avatar/avatar.ts) and the facing angle in radians
  avatar: string
  rot: number
}

export interface IComputer extends Schema {
  connectedUser: SetSchema<string>
}

export interface INote extends Schema {
  x: number
  y: number
  width: number
  height: number
  text: string
  color: string
  author: string
}

export interface IArrow extends Schema {
  from: string
  to: string
  fromSide: string
  toSide: string
}

export interface IWhiteboard extends Schema {
  connectedUser: SetSchema<string>
  notes: MapSchema<INote>
  arrows: MapSchema<IArrow>
}

export interface IChatMessage extends Schema {
  author: string
  createdAt: number
  content: string
}

export interface IOfficeState extends Schema {
  players: MapSchema<IPlayer>
  computers: MapSchema<IComputer>
  whiteboards: MapSchema<IWhiteboard>
  chatMessages: ArraySchema<IChatMessage>
}
