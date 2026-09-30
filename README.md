# VirtualOffice 3D ![License](https://img.shields.io/badge/license-MIT-blue)

A virtual office in the browser as an isometric toy diorama: toon shading, pastel colours and procedural chibi characters you design yourself. Walk around, sit down, chat, wave, grab a drink, and talk to the people close to you with video and audio.

It started as a fork of [SkyOffice](https://github.com/kevinshen56714/SkyOffice) (Phaser 2D). The 2D client and the whiteboards are gone; what is left is a lean 3D demo. See [POC2_NOTIZ.md](POC2_NOTIZ.md) (German) for the findings, measurements and the status of every feature.

## Built with

- [React Three Fiber](https://r3f.docs.pmnd.rs) and [three.js](https://threejs.org) - 3D client (`client-3d/`)
- [Colyseus](https://github.com/colyseus/colyseus) - WebSocket server for rooms and state sync (`server/`)
- [LiveKit](https://livekit.io) - WebRTC media server for video, audio and screen sharing (`packages/media/`)
- [Tiled](https://www.mapeditor.org) - the office map (`assets/map/`)

## Repository

| Path              | What                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------- |
| `client-3d/`      | the 3D client (Vite, React 19, R3F 9, zustand)                                          |
| `server/`         | the Colyseus server (rooms, chat, avatars, LiveKit tokens)                              |
| `packages/media/` | video/audio/screen sharing via LiveKit (`MediaManager`, `ScreenShareSession`, hooks)    |
| `types/`          | types shared by client and server (messages, state, map zones, media rooms)             |
| `assets/map/`     | the Tiled map (`map.json`) and its tilesets; source for the 3D map and the server zones |
| `docs/`           | screenshots                                                                             |

## Getting started

You'll need [Node.js](https://nodejs.org/en/) 22.18 or newer. The [LiveKit server](https://docs.livekit.io/home/self-hosting/local/) is optional (only for video chat and screen sharing).

```bash
npm install
npm run dev            # server (ws://localhost:2567) + 3D client (http://localhost:3100)
```

or separately with `npm run dev:server` and `npm run dev:client3d`. Open http://localhost:3100, enter a name, optionally design your character, and join.

LiveKit is optional: without it the office works, the HUD shows "Video-Chat nicht verfügbar" and screen sharing says it is not available. Start `npm run dev:livekit` (needs `livekit-server` installed) to talk to the people close to you.

If the server runs on another port, pass its URL: `VITE_SERVER_URL=ws://localhost:2667 npm run dev:client3d` (and `PORT=2667 npm run dev:server`).

## Controls

| Key / mouse            |                                          |
| ---------------------- | ---------------------------------------- |
| `W A S D` / arrow keys | walk (screen directions)                 |
| click on the floor     | walk there (path finding around objects) |
| click a chair / item   | walk there and sit down / use it         |
| `E`                    | sit down / stand up                      |
| `R`                    | use computer, vending machine            |
| `Space` / `1` / `2`    | hop / wave / cheer                       |
| mouse wheel            | zoom                                     |
| `Enter`                | chat                                     |

## Scripts

| Command               | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `npm run dev`         | server and 3D client in watch/dev mode                                  |
| `npm run dev:livekit` | a local LiveKit server (`livekit-server --dev`)                         |
| `npm run build`       | build the server (`server/lib`) and the 3D client (`client-3d/dist`)    |
| `npm start`           | run the built server                                                    |
| `npm run typecheck`   | type-check all workspaces                                               |
| `npm run lint`        | lint with ESLint                                                        |
| `npm run format`      | format with Prettier                                                    |
| `npm run extract-map` | regenerate `client-3d/src/map/office.generated.json` from the Tiled map |
| `npm run bots -- 40`  | fill the conference room with 40 bots (`ws://localhost:2567`)           |

More tools in `client-3d/scripts/`:

| Command                                                     | Description                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `node client-3d/scripts/measure.mjs http://localhost:3100/` | measure FPS and draw calls in headless Chromium (`CHROME_PATH=…`) |
| `node client-3d/scripts/media-smoke.mjs`                    | video chat UI smoke test with fake camera/microphone              |
| http://localhost:3100/?gallery                              | all chibi presets side by side                                    |

## The map

`assets/map/map.json` is a [Tiled](https://www.mapeditor.org) map; its tilesets are in `assets/map/tilesets/`. It is the single source for the layout: `npm run extract-map` turns it into the 3D data (walkable tiles, collision rectangles, furniture blocks with averaged colours, chairs, computers, zones), and the server reads the computers, the spawn point and the media zones from it at start. The whiteboard objects in the map are left over from the 2D client and ignored.

## Video chat

Video, audio and screen sharing run through [LiveKit](https://livekit.io). The office is split into media rooms by the `Zones` layer of the map: in the open space you hear the people close to you, in meeting rooms and focus booths everyone in the room (and nobody outside), in the auditorium only the people on the stage speak, and quiet zones (the library) have no video at all. The server hands out a LiveKit token only for the room at the player's position.

For production, run a [LiveKit server](https://docs.livekit.io/home/self-hosting/deployment/) or use [LiveKit Cloud](https://livekit.io/cloud) and set these environment variables for the server:

| Variable             | Description                                                                      |
| -------------------- | -------------------------------------------------------------------------------- |
| `LIVEKIT_URL`        | WebSocket URL of LiveKit **as the browser sees it**, e.g. `wss://lk.example.com` |
| `LIVEKIT_API_KEY`    | LiveKit API key                                                                  |
| `LIVEKIT_API_SECRET` | LiveKit API secret                                                               |

Without them in development, the server uses the defaults of `livekit-server --dev`. With `NODE_ENV=production` and missing variables, video chat is off.

## Whiteboards

The built-in sticky note whiteboards were removed. Whiteboards are planned as an external service (e.g. Miro) instead.

## Credits

Based on [SkyOffice](https://github.com/kevinshen56714/SkyOffice) by kevinshen56714. The map uses the pixel art of [LimeZu](https://limezu.itch.io/) (the 3D client only uses its layout and averaged colours).

## License

This project is licensed under MIT.
