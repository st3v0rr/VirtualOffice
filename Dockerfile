# syntax=docker/dockerfile:1
# VirtualOffice: the Colyseus server, which also serves the built 3D client, on one
# port (2567, HTTP and WebSocket). LiveKit (video chat) runs outside, see docker-compose.yml.
#
#   docker build -t virtualoffice .
#   docker run -p 2567:2567 virtualoffice           -> http://localhost:2567

ARG NODE_VERSION=22

# ---- 1. build: install everything, type-check, build server and client ----
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app

# the manifests first, so the npm ci layer is cached as long as they don't change
COPY package.json package-lock.json ./
COPY types/package.json types/
COPY packages/media/package.json packages/media/
COPY server/package.json server/
COPY client-3d/package.json client-3d/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run typecheck && npm run build

# ---- 2. runtime: only the server's production dependencies and the build output ----
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=2567 \
    STATIC_DIR=/app/client-3d/dist

COPY package.json package-lock.json ./
COPY types/package.json types/
COPY packages/media/package.json packages/media/
COPY server/package.json server/
COPY client-3d/package.json client-3d/
# without optional/peer packages: colyseus lists uWebSockets.js, vite and typescript as
# optional peers, which would triple the image size and are not used
RUN npm ci --omit=dev --omit=optional --omit=peer --workspace server --no-audit --no-fund \
    && npm cache clean --force

COPY --from=build /app/server/lib server/lib
COPY --from=build /app/client-3d/dist client-3d/dist
# the office map: the server validates it at start, uses its computers, spawn and media
# zones, and serves it to the clients at /map.json (another map: OFFICE_MAP_PATH)
COPY assets/map/office.json assets/map/office.json

USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -q -O /dev/null http://127.0.0.1:2567/healthz || exit 1
CMD ["node", "server/lib/server/index.js"]
