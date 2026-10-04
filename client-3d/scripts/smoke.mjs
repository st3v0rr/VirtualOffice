// End-to-end smoke test of the demo as it is deployed: the built server serving the
// built 3D client on one port (like the Docker image).
//
//   npm run build && npm run smoke                  starts server/lib with STATIC_DIR itself
//   SMOKE_URL=http://localhost:2567 npm run smoke   tests a running server / container
//
// 1. HTTP: index.html, /config.js, the bundles, /healthz
// 2. WebSocket (Node, no browser): join the office, set a name, move, see the state
// 3. Browser (headless Chromium): enter a name, join, the own player and name tag show up,
//    walking with the keyboard moves it, no page or console errors; a screenshot is saved
//    to SMOKE_SCREENSHOT (default smoke-artifacts/smoke.png)
//
// Chromium: CHROME_PATH, else Playwright's own (npx playwright-core install chromium), else
// the system Chromium. Without any, step 3 is skipped with a note, unless SMOKE_BROWSER=1
// demands it (CI).
/* global document, __game -- used inside page.evaluate(), which runs in the browser */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { Client } from '@colyseus/sdk'
import { chromium } from 'playwright-core'

const root = path.resolve(import.meta.dirname, '..', '..')
const screenshot = path.resolve(
  process.env.SMOKE_SCREENSHOT ?? path.join(root, 'smoke-artifacts', 'smoke.png')
)

let failed = false
const check = (ok, text) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`)
  if (!ok) failed = true
  return ok
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---- the server ----

let server
let base = process.env.SMOKE_URL?.replace(/\/$/, '')
if (!base) {
  const port = Number(process.env.SMOKE_PORT ?? 2599)
  const entry = path.join(root, 'server', 'lib', 'server', 'index.js')
  const staticDir = path.join(root, 'client-3d', 'dist')
  if (!existsSync(entry) || !existsSync(staticDir)) {
    console.error('Build first: npm run build')
    process.exit(1)
  }
  server = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT: String(port), STATIC_DIR: staticDir, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const log = []
  server.stdout.on('data', (d) => log.push(String(d)))
  server.stderr.on('data', (d) => log.push(String(d)))
  server.on('exit', (code) => {
    if (code) console.error(`server exited with ${code}\n${log.join('')}`)
  })
  base = `http://localhost:${port}`
}
const stop = () => server?.kill()

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${base}/healthz`)
      if (res.ok) return true
    } catch {
      // not up yet
    }
    await sleep(500)
  }
  return false
}

if (!check(await waitForServer(), `server answers on ${base}/healthz`)) {
  stop()
  process.exit(1)
}

// ---- 1. HTTP ----

const html = await (await fetch(`${base}/`)).text()
check(html.includes('<div id="root">'), 'index.html is served')
const config = await fetch(`${base}/config.js`)
const configText = await config.text()
check(
  config.ok && configText.includes('__VIRTUALOFFICE_CONFIG__'),
  `/config.js is the run time configuration (${configText.trim()})`
)
const scripts = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])
check(scripts.length > 0, 'index.html references the bundles')
for (const script of scripts) {
  const res = await fetch(`${base}${script}`)
  check(res.ok && Number(res.headers.get('content-length') ?? 1) > 0, `bundle ${script} loads`)
}

// ---- 2. WebSocket ----

const wsUrl = base.replace(/^http/, 'ws')
try {
  const client = new Client(wsUrl)
  const room = await client.joinOrCreate('skyoffice')
  room.onMessage('*', () => {})
  room.send(1, { name: 'Smoke-Bot' }) // UPDATE_PLAYER_NAME
  room.send(0, { x: 1100, y: 520, anim: 'adam_run_left', rot: 0 }) // UPDATE_PLAYER
  await sleep(500)
  const me = room.state.players.get(room.sessionId)
  check(me?.name === 'Smoke-Bot', 'WebSocket: joined the office and set the name')
  check(me?.x === 1100 && me?.y === 520, 'WebSocket: the server took the new position')
  check(room.state.computers.size > 0, 'WebSocket: the room has the computers of the map')
  await room.leave()
} catch (error) {
  check(false, `WebSocket: join ${wsUrl} (${error?.message ?? error})`)
}

// ---- 3. Browser ----

function findChromium() {
  const candidates = [
    process.env.CHROME_PATH,
    chromium.executablePath(),
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ]
  return candidates.find((candidate) => candidate && existsSync(candidate))
}

const executablePath = findChromium()
if (!executablePath) {
  const text =
    'Browser: no Chromium found (CHROME_PATH, npx playwright-core install chromium, or a system Chromium)'
  if (process.env.SMOKE_BROWSER === '1') check(false, text)
  else console.log(`skip ${text}; only the HTTP and WebSocket checks ran`)
} else {
  console.log(`     Chromium: ${executablePath}`)
  const browser = await chromium.launch({ executablePath })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(`page error: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error')
        errors.push(`console error: ${message.text()} (${message.location().url})`)
    })

    // ?debug exposes window.__game with the player position
    await page.goto(`${base}/?debug`)
    await page.fill('.join input', 'Rauchtest')
    // the join screen: name, room (public office), camera/microphone (off), then Beitreten
    for (const label of ['Weiter', 'Weiter', 'Beitreten'])
      await page.click(`.join button.primary:has-text("${label}")`)
    await page.waitForSelector('.hud-top', { timeout: 15000 })
    check(true, 'Browser: joined the office')
    check(
      await page.evaluate(() => !!document.querySelector('canvas')),
      'Browser: the 3D scene renders into a canvas'
    )
    const tag = page.locator('.tag .name', { hasText: 'Rauchtest' })
    check(
      await tag
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false),
      'Browser: my player is there (name tag "Rauchtest" visible)'
    )

    const position = () => page.evaluate(() => ({ x: __game.me.x, z: __game.me.z }))
    const before = await position()
    await page.keyboard.down('KeyS')
    await page.waitForTimeout(700)
    await page.keyboard.up('KeyS')
    await page.waitForTimeout(200)
    const after = await position()
    const moved = Math.hypot(after.x - before.x, after.z - before.z)
    check(
      moved > 0.5,
      `Browser: walking with the keyboard moves the player (${moved.toFixed(2)} tiles)`
    )

    mkdirSync(path.dirname(screenshot), { recursive: true })
    await page.screenshot({ path: screenshot })
    console.log(`     screenshot: ${path.relative(process.cwd(), screenshot)}`)
    check(errors.length === 0, `Browser: no page or console errors ${errors.join('; ')}`)
  } catch (error) {
    check(false, `Browser: ${error?.message ?? error}`)
  } finally {
    await browser.close()
  }
}

stop()
process.exit(failed ? 1 : 0)
