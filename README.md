# VirtualOffice 3D ![License](https://img.shields.io/badge/license-MIT-blue)

A browser-based, real-time 3D virtual office built as an independent application. Explore an isometric toy-diorama office with toon shading, pastel colours and customizable procedural chibi characters. Walk around, sit at a desk, use a computer or vending machine, chat, react with emotes, and talk to nearby people with video, audio and screen sharing. Meeting rooms, focus booths, a stage and a quiet library each have their own media rules.

## Built with

- [React Three Fiber](https://r3f.docs.pmnd.rs) and [three.js](https://threejs.org) - 3D client (`client-3d/`)
- [Colyseus](https://github.com/colyseus/colyseus) - WebSocket server for rooms and state sync (`server/`)
- [LiveKit](https://livekit.io) - WebRTC media server for video, audio and screen sharing (`packages/media/`)

## Repository

| Path              | What                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------- |
| `client-3d/`      | the 3D client (Vite, React 19, R3F 9, zustand)                                          |
| `server/`         | the Colyseus server (rooms, chat, avatars, LiveKit tokens)                              |
| `packages/media/` | video/audio/screen sharing via LiveKit (`MediaManager`, `ScreenShareSession`, hooks)    |
| `types/`          | types shared by client and server (messages, state, the map format, media rooms)        |
| `assets/map/`     | the office map (`office.json`) in VirtualOffice's own format, used by server and client |
| `docs/`           | the map format and the map editor (`map-format.md`)                                     |

## Getting started

You'll need [Node.js](https://nodejs.org/en/) 22.18 or newer. The [LiveKit server](https://docs.livekit.io/home/self-hosting/local/) is optional (only for video chat and screen sharing).

```bash
npm install
npm run dev            # server (ws://localhost:2567) + 3D client (http://localhost:3100)
```

or separately with `npm run dev:server` and `npm run dev:client3d`. Open http://localhost:3100, enter a name, optionally design your character, and join. The map editor is at http://localhost:3100/?editor.

LiveKit is optional: without it the office works, the HUD shows "Video-Chat nicht verfügbar" and screen sharing says it is not available. Start `npm run dev:livekit` (needs `livekit-server` installed) to talk to the people close to you.

If the server runs on another port, pass its URL: `VITE_SERVER_URL=ws://localhost:2667 npm run dev:client3d` (and `PORT=2667 npm run dev:server`).

## Controls

| Key / mouse            |                                                            |
| ---------------------- | ---------------------------------------------------------- |
| click on the floor     | walk there (path finding around objects)                   |
| click a chair / item   | walk there and sit down / use it                           |
| `W A S D` / arrow keys | walk (screen directions)                                   |
| `E`                    | sit down / stand up                                        |
| `R`                    | use computer, vending machine                              |
| `1`                    | wave                                                       |
| `2`                    | cheer with confetti                                        |
| `3`                    | clap                                                       |
| `4`                    | hearts                                                     |
| `5`                    | raise / lower your hand; it stays raised until toggled off |
| mouse wheel            | zoom                                                       |
| `Enter`                | chat                                                       |

## Scripts

| Command                | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run dev`          | server and 3D client in watch/dev mode                               |
| `npm run dev:livekit`  | a local LiveKit server (`livekit-server --dev`)                      |
| `npm run build`        | build the server (`server/lib`) and the 3D client (`client-3d/dist`) |
| `npm start`            | run the built server                                                 |
| `npm run typecheck`    | type-check all workspaces                                            |
| `npm run lint`         | lint with ESLint                                                     |
| `npm run format`       | format with Prettier                                                 |
| `npm run validate-map` | check a map file like the server does (`-- path/to/map.json`)        |
| `npm run bots -- 40`   | fill the conference room with 40 bots (`ws://localhost:2567`)        |

More tools in `client-3d/scripts/`:

| Command                                                     | Description                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `node client-3d/scripts/measure.mjs http://localhost:3100/` | measure FPS and draw calls in headless Chromium (`CHROME_PATH=…`) |
| `node client-3d/scripts/media-smoke.mjs`                    | video chat UI smoke test with fake camera/microphone              |
| http://localhost:3100/?gallery                              | all chibi presets side by side                                    |
| http://localhost:3100/?editor                               | the map editor (see [The map](#the-map))                          |

## Tests

- `npm test` runs the Vitest unit tests of `packages/media`, `server` and `client-3d` and prints a v8 coverage report (no threshold). They cover the logic: the proximity hysteresis and the media zones (quiet library, meeting room, stage), device settings and avatar persistence, the server's input validation and commands, the LiveKit token, the map format (validation with its error messages, the file layout, local-only model paths), that the converted office behaves like the former Tiled map (same floor, collision cell by cell, chairs, computers, zones, spawn), loading the map on the server and serving it at `/map.json`, the editor's operations, undo/redo, import/export and checks, collision, path finding and smoothing, chair occupancy and the avatar format.
- `npm run smoke` (after `npm run build`) starts the built server with the built client on one port, checks HTTP and a WebSocket join, then joins in headless Chromium, walks and takes a screenshot (`smoke-artifacts/smoke.png`), and works with the map editor (place, turn, move and delete assets, paint, draw a zone, undo/redo, 3D preview, export, import, the draft after a reload; `smoke-artifacts/editor.png`). Chromium comes from `CHROME_PATH`, Playwright (`npx playwright-core install chromium`) or the system; without one only the HTTP and WebSocket checks run. `SMOKE_URL=http://host:2567 npm run smoke` tests a running server or container instead.

## Running it on a server (Docker)

The Docker image contains the Colyseus server, which also serves the built 3D client: **one container, one port (2567) for the page and the WebSocket**. LiveKit (video chat) is optional and runs outside of it.

```bash
docker build -t virtualoffice .
docker run -d --name virtualoffice -p 2567:2567 --restart unless-stopped virtualoffice
# -> http://<host>:2567
```

or with Compose (builds the image, or set `DEMO_IMAGE` to a pulled one; copy `.env.example` to `.env` for the settings):

```bash
docker compose up -d                     # the office app
docker compose --profile livekit up -d   # plus LiveKit in dev mode, for trying out video chat
```

Podman works too (`podman compose` uses podman-compose as its provider). Two differences:
pull the LiveKit image with its full name first, because Podman enforces registry
short-name resolution and cannot prompt inside compose, and add the livekit overlay so the
app gets the dev keys:

```bash
podman pull docker.io/livekit/livekit-server:latest
DEMO_IMAGE=st3v0rr/virtualoffice:latest podman compose --profile livekit \
  -f docker-compose.yml -f docker-compose.livekit.yml up -d
# -> http://localhost:2567  (stop again with: podman compose down)
```

Without `DEMO_IMAGE` compose builds the image from this checkout; with it, the published
image from Docker Hub runs.

| Variable             | Default           | Description                                                                                                                                                                                   |
| -------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`               | `2567`            | port inside the container                                                                                                                                                                     |
| `PUBLIC_SERVER_URL`  | (empty)           | WebSocket URL of the server as the browser sees it, e.g. `wss://office.example.com`. Empty: the host and port of the page, which is right when the proxy forwards WebSockets on the same host |
| `LIVEKIT_URL`        | (empty)           | LiveKit URL as the browser sees it (`wss://…` if the page is HTTPS). Empty: video chat off, the office works without it                                                                       |
| `LIVEKIT_API_KEY`    | (empty)           | LiveKit API key                                                                                                                                                                               |
| `LIVEKIT_API_SECRET` | (empty)           | LiveKit API secret                                                                                                                                                                            |
| `COLYSEUS_MONITOR`   | off in production | `true` enables the Colyseus monitor on `/colyseus` (no login, it shows all rooms and players, so keep it private)                                                                             |
| `STATIC_DIR`         | `client-3d/dist`  | the built client the server serves; unset = WebSocket server only                                                                                                                             |
| `OFFICE_MAP_PATH`    | `assets/map/…`    | another map file (VirtualOffice format) for the server; the clients load the map from the server, see [The map](#the-map)                                                                     |

`GET /healthz` answers `{"ok":true}` (used by the image's `HEALTHCHECK`); `/config.js` hands `PUBLIC_SERVER_URL` to the client at run time, so the same image works under any host name.

**HTTPS is needed for camera and microphone.** Browsers only allow them in a secure context (HTTPS, or `http://localhost`). On a server, put a reverse proxy with TLS in front, which also has to forward WebSockets, e.g. [Caddy](https://caddyserver.com) (gets the certificate by itself):

```
office.example.com {
    reverse_proxy localhost:2567
}
```

Then open `https://office.example.com`; the client connects to `wss://office.example.com` without further settings. LiveKit needs its own TLS name (e.g. `livekit.example.com` → port 7880) and its media ports open (7881/tcp, 7882/udp in dev mode, see the [LiveKit deployment docs](https://docs.livekit.io/home/self-hosting/deployment/)); the `livekit` profile runs it with the public dev keys and is only meant for trying it out.

### CI and Docker Hub

`.github/workflows/ci.yml` runs on pushes and pull requests: `npm ci`, typecheck, lint, format check, build, `npm test`, the smoke test in Chromium (screenshot as artifact), then builds the Docker image and tests the running container with curl (health, page, config, office map, bundles, monitor off, health status).

On pushes to `main` it pushes the image to Docker Hub as `latest` and the short commit sha. This needs the repository secrets `DOCKER_HUB_USERNAME` and `DOCKER_HUB_TOKEN`; without them the push is skipped with a notice. The image name comes from the repository variable (or secret) `DOCKERHUB_IMAGE`, defaulting to `st3v0rr/virtualoffice`.

## The map

`assets/map/office.json` is the single source of the office layout, in VirtualOffice's own versioned JSON format: a grid of floor, wall and void tiles with their colours, the spawn point, room labels, media zones and the placements of furniture and other assets from a catalog (chairs, computers and vending machines included). The server checks it at start (a broken map stops it with a list of the problems), uses its computers, spawn and zones, and serves it read-only at `GET /map.json`; the 3D client loads it from there, so both always use the same map. The format, the checks and the asset catalog are described in [docs/map-format.md](docs/map-format.md).

**Map editor**: open `/?editor` (or ⚙️ → „Karteneditor öffnen“ in the office). It loads the server's map, paints floors and walls, places, moves, turns and deletes assets from the catalog, sets their collision (even per tile), the spawn point, media zones and room labels, shows collision and reachability, previews the map in 3D and imports and exports map files. Drafts stay in the browser; nothing is written to the server.

**Putting an edited map into the office**: export it, check it with `npm run validate-map -- my-office.json`, then either replace `assets/map/office.json` and rebuild, or mount the file into the container and set `OFFICE_MAP_PATH` (no rebuild needed), and restart the server:

```bash
docker run -d -p 2567:2567 -v "$PWD/my-office.json:/maps/office.json:ro" \
  -e OFFICE_MAP_PATH=/maps/office.json virtualoffice
```

## Video chat

Video, audio and screen sharing run through [LiveKit](https://livekit.io). The office is split into media rooms by the media zones of the map: in the open space you hear the people close to you, in meeting rooms and focus booths everyone in the room (and nobody outside), in the auditorium only the people on the stage speak, and quiet zones (the library) have no video at all. The server hands out a LiveKit token only for the room at the player's position.

For production, run a [LiveKit server](https://docs.livekit.io/home/self-hosting/deployment/) or use [LiveKit Cloud](https://livekit.io/cloud) and set these environment variables for the server:

| Variable             | Description                                                                      |
| -------------------- | -------------------------------------------------------------------------------- |
| `LIVEKIT_URL`        | WebSocket URL of LiveKit **as the browser sees it**, e.g. `wss://lk.example.com` |
| `LIVEKIT_API_KEY`    | LiveKit API key                                                                  |
| `LIVEKIT_API_SECRET` | LiveKit API secret                                                               |

Without them in development, the server uses the defaults of `livekit-server --dev`. With `NODE_ENV=production` and missing variables, video chat is off.

## Whiteboards

There are no built-in whiteboards. Whiteboards are planned as an external service (e.g. Miro) instead.

## License

This project is licensed under MIT.
