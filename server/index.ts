import express from 'express'
import cors from 'cors'
import { Server, LobbyRoom, WebSocketTransport, monitor } from 'colyseus'
import { RoomType } from '../types/Rooms.ts'
import { SkyOffice } from './rooms/SkyOffice.ts'

const port = Number(process.env.PORT || 2567)

const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    app.use(cors())
    app.use(express.json())

    // register colyseus monitor
    app.use('/colyseus', monitor())
  },
})

// register room handlers
gameServer.define(RoomType.LOBBY, LobbyRoom)
gameServer.define(RoomType.PUBLIC, SkyOffice, {
  name: 'Public Lobby',
  description: 'For making friends and familiarizing yourself with the controls',
  password: null,
  autoDispose: false,
})
gameServer.define(RoomType.CUSTOM, SkyOffice).enableRealtimeListing()

await gameServer.listen(port)
console.log(`Listening on ws://localhost:${port}`)
