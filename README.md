# SkyOffice ![License](https://img.shields.io/badge/license-MIT-blue) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-green.svg)

<img alt="Logo" align="right" src="https://user-images.githubusercontent.com/11501902/139942585-a6b044ce-3695-460a-91bd-dd9f1d4611c8.png" width="20%" />

An immersive virtual office - Winner of [2021 Monte Jade Innovation Competition](https://www.montejadese.org/innovation-competition)

- Come try it out - [Official Website](https://skyoffice.netlify.app)
- Why we built this - [Concept Video](https://www.youtube.com/watch?v=BpDqGTPh8pc)
- 🙌 Get latest updates? Follow our [Twitter](https://twitter.com/SkyOfficeApp).
- 💕 Love this project? Consider [buy me a coffee](https://www.buymeacoffee.com/skyoffice).

SkyOffice works on all PC browsers (mobile browsers are currently not supported)

## Built with

- [Phaser3](https://github.com/photonstorm/phaser) - Game engine
- [Colyseus](https://github.com/colyseus/colyseus) - WebSocket-based server framework
- [React/Redux](https://github.com/facebook/react) - Front-end framework
- [LiveKit](https://livekit.io) - WebRTC media server for video, audio and screen sharing
- [TypeScript](https://github.com/microsoft/TypeScript) and [ES6](https://github.com/eslint/eslint) - for both client and server sides

## Features

- [Proximity Chat](#proximity-chat-distance-based-interactive-system)
- [Flexible Screen Sharing](#flexible--immediate-screen-sharing)
- [Multifunctional Rooms](#multifunctional-rooms)
- [Text Message Chat](#text-message-chat-with-real-time-dialog-bubbles)
- [Custom/Private Rooms](#customprivate-rooms)
- [Whiteboards](#whiteboards) with sticky notes and arrows, synced live (built with [React Flow](https://reactflow.dev))

### Proximity Chat (distance-based interactive system)

![image](https://user-images.githubusercontent.com/11501902/139960852-cf0e0883-8fbe-459d-bb11-3707d0ae1360.png)

### Multifunctional Rooms

![image](https://user-images.githubusercontent.com/11501902/139961091-1801bd4d-fbd6-4400-8503-85ece744e979.png)

### Flexible & Immediate Screen Sharing

![image](https://user-images.githubusercontent.com/11501902/139961155-44a85cd9-ac25-4563-9d82-6537ed7435f6.png)

### Text Message Chat (with real time dialog bubbles)

![image](https://user-images.githubusercontent.com/11501902/145925423-3b5b9026-d3b9-429d-920b-98b0bcd6300a.png)

### Whiteboards

Press `R` in front of a whiteboard to open it. Add sticky notes with the toolbar or by double-clicking the board, double-click a note to write, drag from the dots on its edges to connect notes with arrows, and use `Del` to delete the selection. Everyone at the same whiteboard sees the changes live. Boards are kept in the server's memory, so they're reset when the server restarts or a custom room is closed.

### Custom/Private Rooms

![image](https://user-images.githubusercontent.com/11501902/147784118-15ef50bf-0f67-4704-89d7-81b2fa7f8ceb.png)

## Controls

- `W, A, S, D, or arrow keys` to move (video chat will start if you are close to someone else)
- `E` to sit down
- `R` to use computer (for screen sharing)
- `Enter` to open chat
- `ESC` to close chat

## Prerequisites

You'll need [Node.js](https://nodejs.org/en/) 22.12 or newer (npm is included) and the [LiveKit server](https://docs.livekit.io/home/self-hosting/local/) for video chat, e.g. `brew install livekit` on macOS.

## Getting Started

Clone this repository and install all dependencies (the repo is an npm workspace with `server`, `client` and `types`):

```bash
git clone https://github.com/kevinshen56714/SkyOffice.git
cd SkyOffice
npm install
```

Start server (`ws://localhost:2567`), client (`http://localhost:3000`) and a local LiveKit server (`ws://localhost:7880`) together:

```bash
npm run dev
```

or separately with `npm run dev:server`, `npm run dev:client` and `npm run dev:livekit`.

## Scripts

| Command             | Description                                                                          |
| ------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev`       | Start server, client and LiveKit in watch/dev mode                                   |
| `npm run dev3d`     | Start server and the 3D client (see [PoC 3D](#poc-3d))                               |
| `npm run build`     | Build server (`server/lib`), client (`client/dist`) and 3D client (`client-3d/dist`) |
| `npm start`         | Run the built server                                                                 |
| `npm run typecheck` | Type-check all workspaces                                                            |
| `npm run lint`      | Lint with ESLint                                                                     |
| `npm run format`    | Format with Prettier                                                                 |

For production builds of the client, set `VITE_SERVER_URL` to the WebSocket URL of your server (e.g. `wss://my-server.example.com`).

## PoC 3D

`client-3d/` is a proof of concept of the office in 3D with [React Three Fiber](https://r3f.docs.pmnd.rs): an isometric toy diorama with toon shading, pastel colours, outlines and procedural chibi characters with a character editor. It talks to the same Colyseus server as the 2D client, so players of both clients meet in the same rooms. The 2D client is unchanged. See [POC2_NOTIZ.md](POC2_NOTIZ.md) for the findings, measurements and the status of every feature.

```bash
npm install
npm run dev3d              # server (ws://localhost:2567) + 3D client (http://localhost:3100)
# or separately:
npm run dev:server
npm run dev:client3d
```

Open http://localhost:3100, enter a name, optionally design your character, and join. The 2D client (`npm run dev:client`, http://localhost:3000) can run at the same time for comparison. LiveKit is optional: without it the office works, the HUD shows "Medien nicht verfügbar" and screen sharing says it is not available.

If the server runs on another port, pass its URL: `VITE_SERVER_URL=ws://localhost:2667 npm run dev:client3d` (and `PORT=2667 npm run dev:server`).

| Controls               |                                           |
| ---------------------- | ----------------------------------------- |
| `W A S D` / arrow keys | walk (screen directions)                  |
| click on the floor     | walk there (path finding around objects)  |
| click a chair / item   | walk there and sit down / use it          |
| `E`                    | sit down / stand up                       |
| `R`                    | use computer, whiteboard, vending machine |
| `Space` / `1` / `2`    | hop / wave / cheer                        |
| mouse wheel            | zoom                                      |
| `Enter`                | chat                                      |

| Command (in `client-3d/`)                                   | Description                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `npm run extract-map -w client-3d`                          | regenerate `src/map/office.generated.json` from the Tiled map     |
| `node client-3d/scripts/bots.mjs 40 ws://localhost:2567`    | fill the conference room with 40 bots                             |
| `node client-3d/scripts/measure.mjs http://localhost:3100/` | measure FPS and draw calls in headless Chromium (`CHROME_PATH=…`) |
| `node client-3d/scripts/fake-2d-player.mjs`                 | a player that behaves like the 2D client                          |
| http://localhost:3100/?gallery                              | all chibi presets side by side                                    |

## Video chat

Video, audio and screen sharing run through [LiveKit](https://livekit.io). The office is split into media rooms by the `Zones` layer of the map: in the open space you hear the people close to you, in meeting rooms and focus booths everyone in the room (and nobody outside), in the auditorium only the people on the stage speak, and quiet zones have no video at all. The server hands out a LiveKit token only for the room at the player's position.

For production, run a [LiveKit server](https://docs.livekit.io/home/self-hosting/deployment/) or use [LiveKit Cloud](https://livekit.io/cloud) and set these environment variables for the SkyOffice server:

| Variable             | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `LIVEKIT_URL`        | WebSocket URL of LiveKit, e.g. `wss://lk.example.com` |
| `LIVEKIT_API_KEY`    | LiveKit API key                                       |
| `LIVEKIT_API_SECRET` | LiveKit API secret                                    |

Without them in development, the server uses the defaults of `livekit-server --dev`.

The day/night background follows sunrise and sunset. It uses the center of Germany by default; set `VITE_OFFICE_LATITUDE` and `VITE_OFFICE_LONGITUDE` to use the location of your office instead.

## Credits 🎉

Big thanks to this great repo - [ourcade/phaser3-typescript-parcel-template](https://github.com/ourcade/phaser3-typescript-parcel-template)

Big thanks to pixel artist - [LimeZu](https://limezu.itch.io/)

## License

This project is licensed under MIT.

If you're using SkyOffice to power your virtual office or using our code in other projects, please consider [buy me a coffee](https://www.buymeacoffee.com/skyoffice). Thank you :)
