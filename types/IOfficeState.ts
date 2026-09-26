import { Schema, ArraySchema, SetSchema, MapSchema } from '@colyseus/schema'

export interface IPlayer extends Schema {
  name: string
  x: number
  y: number
  anim: string
  readyToConnect: boolean
  videoConnected: boolean
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
