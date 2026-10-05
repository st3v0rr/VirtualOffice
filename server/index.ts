import express from 'express'
import cors from 'cors'
import { Server, LobbyRoom, WebSocketTransport, monitor } from 'colyseus'
import { RoomType } from '../types/Rooms.ts'
import { SkyOffice } from './rooms/SkyOffice.ts'
import { officeMapData, officeMapFile } from './officeMap.ts'
import { serveClient, serveMap } from './web.ts'

const port = Number(process.env.PORT || 2567)
const isProduction = process.env.NODE_ENV === 'production'
// the monitor lists all rooms and players and has no login, so not in production by default
const withMonitor = process.env.COLYSEUS_MONITOR
  ? process.env.COLYSEUS_MONITOR === 'true'
  : !isProduction

const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    app.use(cors())
    app.use(express.json())

    app.get('/healthz', (_req, res) => {
      res.json({ ok: true })
    })

    if (withMonitor) app.use('/colyseus', monitor())

    // the office map for the clients (also for the dev server of the client, via CORS)
    serveMap(app, officeMapData)

    // the built 3D client (Docker image, npm run start:demo)
    if (process.env.STATIC_DIR) serveClient(app, process.env.STATIC_DIR, process.env)
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
console.log(`Office map: ${officeMapFile} ("${officeMapData.name}")`)
if (process.env.STATIC_DIR) console.log(`Serving the 3D client on http://localhost:${port}`)
