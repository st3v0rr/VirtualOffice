// End-to-end smoke test of the demo as it is deployed: the built server serving the
// built 3D client on one port (like the Docker image).
//
//   npm run build && npm run smoke                  starts server/lib with STATIC_DIR itself
//   SMOKE_URL=http://localhost:2567 npm run smoke   tests a running server / container
//
// 1. HTTP: index.html, /config.js, the bundles, /healthz, the office map (/map.json)
// 2. WebSocket (Node, no browser): join the office, set a name, move, see the state
// 3. Browser (headless Chromium): enter a name, join, the own player and name tag show up,
//    walking with the keyboard moves it, no page or console errors; a screenshot is saved
//    to SMOKE_SCREENSHOT (default smoke-artifacts/smoke.png)
// 4. Map editor (?editor): loads the server's map, places, turns, moves and deletes assets,
//    paints tiles, draws a zone, undo/redo, 3D preview, export, import (broken and valid),
//    the draft survives a reload; screenshot smoke-artifacts/editor.png
//
// Chromium: CHROME_PATH, else Playwright's own (npx playwright-core install chromium), else
// the system Chromium. Without any, step 3 is skipped with a note, unless SMOKE_BROWSER=1
// demands it (CI).
/* global document, window, __game -- used inside page.evaluate(), which runs in the browser */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from '@colyseus/sdk'
import { chromium } from 'playwright-core'
// plain TypeScript without enums, so Node runs it directly (type stripping, Node >= 22.18)
import { parseMap } from '../../types/map/validate.ts'

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
// the map the server uses, which the client draws
const mapResponse = await fetch(`${base}/map.json`)
const served = parseMap(mapResponse.ok ? await mapResponse.text() : '')
const officeMap = served.ok ? served.map : null
check(!!officeMap, `/map.json is a valid office map (${officeMap?.name ?? mapResponse.status})`)
const mapComputers = officeMap?.placements.filter((p) => p.asset === 'computer').length ?? 0

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
  check(
    room.state.computers.size > 0 && room.state.computers.size === mapComputers,
    `WebSocket: the room has the computers of the map (${room.state.computers.size})`
  )
  await room.leave()
} catch (error) {
  check(false, `WebSocket: join ${wsUrl} (${error?.message ?? error})`)
}

// ---- 4. the map editor (called from the browser part) ----

async function editorSmoke(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(`page error: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console error: ${message.text()}`)
  })
  const waitFor = (locator, timeout = 10000) =>
    locator
      .waitFor({ timeout })
      .then(() => true)
      .catch(() => false)
  try {
    await page.goto(`${base}/?editor`)
    const view = page.getByTestId('editor-map')
    await view.waitFor({ timeout: 15000 })
    const placements = page.locator('[data-kind=placement]')
    const zones = page.locator('[data-kind=zone]')
    const source = page.locator('.map-name')
    const total = officeMap.placements.length
    check(
      (await placements.count()) === total &&
        (await source.innerText()).includes('Karte des Servers'),
      `Editor: shows the map of the server (${await placements.count()} of ${total} placements)`
    )
    // a point of the map (in tiles) on the screen
    const at = async (x, y) => {
      const box = await view.boundingBox()
      return [
        box.x + (x / officeMap.width) * box.width,
        box.y + (y / officeMap.height) * box.height,
      ]
    }
    const drag = async (from, to) => {
      await page.mouse.move(...(await at(...from)))
      await page.mouse.down()
      await page.mouse.move(...(await at(...to)), { steps: 6 })
      await page.mouse.up()
    }

    // assets come from the catalog: a plant on the corridor floor
    await page.click('[data-asset=plant]')
    await page.mouse.click(...(await at(35.5, 20.5)))
    const plant = page.locator('[data-kind=placement][data-id=plant-10]')
    check(
      (await plant.count()) === 1 && (await placements.count()) === total + 1,
      'Editor: places a plant from the catalog'
    )

    // a table: placed, turned (R) and deleted (Entf)
    await page.click('[data-asset=table]')
    await page.mouse.click(...(await at(35.5, 23)))
    const table = page.locator('[data-kind=placement][data-id=table-3]')
    const placed = (await table.count()) === 1
    await page.keyboard.press('r')
    const turned = await table.getAttribute('data-rotation')
    await page.keyboard.press('Delete')
    check(
      placed && turned === '270' && (await table.count()) === 0,
      `Editor: places, turns (R: ${turned}°) and deletes (Entf) a table`
    )

    // move the plant two tiles up by dragging it
    await page.keyboard.press('v')
    await drag([35.5, 20.5], [35.5, 18.5])
    const y = await page.getByLabel('Y', { exact: true }).inputValue()
    check(y === '18', `Editor: drags the plant (now at y = ${y})`)

    // paint a wall tile, draw a media zone, undo and redo
    await page.click('[data-tile="#"]')
    await page.mouse.click(...(await at(35.5, 25.5)))
    await page.click('[data-tool=zone]')
    await drag([34.3, 10.3], [36.7, 11.7])
    const drawn = await zones.count()
    const inspector = await page.locator('.map-editor-inspector h2').first().textContent()
    await page.keyboard.press('Control+z')
    const undone = await zones.count()
    await page.keyboard.press('Control+Shift+z')
    const redone = await zones.count()
    const z = officeMap.zones.length
    check(
      drawn === z + 1 && inspector.includes('Medienzone') && undone === z && redone === z + 1,
      `Editor: draws a media zone, undo and redo (${drawn}, ${undone}, ${redone} zones; ${inspector})`
    )

    // the draft in 3D, drawn by the components of the office
    await page.click('button:has-text("3D-Vorschau")')
    const preview = await waitFor(page.locator('[data-testid=editor-preview] canvas'), 15000)
    await page.waitForTimeout(500)
    await page.click('button:has-text("2D")')
    check(preview, 'Editor: shows the draft in the 3D preview')

    // export: a valid file with every change
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Exportieren")'),
    ])
    const exported = readFileSync(await download.path(), 'utf8')
    const parsed = parseMap(exported)
    const map = parsed.ok ? parsed.map : null
    const moved = map?.placements.find((p) => p.id === 'plant-10')
    check(
      !!map &&
        download.suggestedFilename() === 'virtualoffice.json' &&
        moved?.x === 35 &&
        moved?.y === 18 &&
        map.tiles[25][35] === '#' &&
        map.zones.length === z + 1 &&
        !map.placements.some((p) => p.id === 'table-3'),
      `Editor: exports the edited map as a valid file (${download.suggestedFilename()})`
    )

    // import: a broken file is refused with its problems, a valid one is taken
    const input = page.getByTestId('editor-import')
    await input.setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"format":"virtualoffice-map","version":1,"name":"Kaputt"}'),
    })
    const alert = page.getByRole('alertdialog', { name: 'Import fehlgeschlagen' })
    const refused =
      (await waitFor(alert, 5000)) && (await alert.locator('.problems li').count()) > 0
    await alert.getByRole('button', { name: 'Schließen' }).click()
    check(
      refused && (await placements.count()) === total + 1,
      'Editor: refuses a broken file and lists its problems'
    )
    await input.setInputFiles({
      name: 'smoke.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exported.replace('"name": "VirtualOffice"', '"name": "Smoke-Büro"')),
    })
    check(
      await waitFor(source.filter({ hasText: 'Smoke-Büro' }), 5000),
      'Editor: imports a valid file'
    )

    // the draft is kept in the browser
    await page.waitForTimeout(700)
    await page.reload()
    await view.waitFor({ timeout: 15000 })
    const draft = await source.innerText()
    check(
      draft.includes('Smoke-Büro') &&
        draft.includes('Lokaler Entwurf') &&
        (await plant.count()) === 1,
      `Editor: the draft survives a reload (${draft})`
    )
    mkdirSync(path.dirname(screenshot), { recursive: true })
    await page.screenshot({ path: path.join(path.dirname(screenshot), 'editor.png') })

    // back to the map of the server, the draft is gone
    await page.click('button:has-text("Karte des Servers laden")')
    await waitFor(source.filter({ hasText: 'Karte des Servers' }), 5000)
    await page.reload()
    await view.waitFor({ timeout: 15000 })
    check(
      (await placements.count()) === total &&
        (await source.innerText()).includes('Karte des Servers'),
      'Editor: loading the map of the server drops the draft'
    )
    check(errors.length === 0, `Editor: no page or console errors ${errors.join('; ')}`)
  } finally {
    await context.close()
  }
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
    const avatarPreview = page.getByRole('img', {
      name: 'Charakter-Vorschau: Dein Avatar im Büro',
    })
    check(await avatarPreview.isVisible(), 'Browser: profile shows the current avatar preview')
    await page.waitForTimeout(400) // let the join panel's entrance animation finish
    const previewBounds = await avatarPreview.boundingBox()
    check(
      !!previewBounds && previewBounds.height >= 199,
      `Browser: avatar preview is 200px tall (${previewBounds?.height ?? 0}px)`
    )
    const profileButtons = page.locator('.avatar-card button')
    check(
      (await profileButtons.count()) === 1 && (await profileButtons.innerText()) === 'Ändern',
      'Browser: profile card has only the Ändern button'
    )
    check(
      (await page.locator('.avatar-preset').count()) === 0,
      'Browser: profile has no preset cards'
    )
    await page.setViewportSize({ width: 320, height: 800 })
    await page.waitForTimeout(100)
    const mobileLayout = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const { left, right, top, bottom, width, height } = element.getBoundingClientRect()
        return { left, right, top, bottom, width, height }
      }
      return {
        preview: rect('.avatar-preview-mini'),
        button: rect('.avatar-card button'),
        card: rect('.avatar-card'),
      }
    })
    check(
      !!mobileLayout.preview && mobileLayout.preview.height >= 199,
      `Browser: preview remains 200px tall on narrow screens (${mobileLayout.preview?.height ?? 0}px)`
    )
    const mobileFits =
      !!mobileLayout.preview &&
      !!mobileLayout.button &&
      !!mobileLayout.card &&
      mobileLayout.preview.left >= mobileLayout.card.left &&
      mobileLayout.preview.right <= mobileLayout.card.right &&
      mobileLayout.button.left >= mobileLayout.card.left &&
      mobileLayout.button.right <= mobileLayout.card.right
    check(
      mobileFits,
      `Browser: avatar and Ändern button fit the 320px card (${JSON.stringify(mobileLayout)})`
    )
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.reload()
    // Keep the profile mounted through its first occasional wave before continuing.
    await page.waitForTimeout(3400)
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

    // settings and controls: one HUD button opens one centered dialog
    const settingsButton = page.getByRole('button', { name: 'Einstellungen & Steuerung' })
    const dialog = page.getByRole('dialog', { name: /Einstellungen & Steuerung/ })
    check(
      (await settingsButton.count()) === 1 &&
        (await settingsButton.getAttribute('title')) === 'Einstellungen & Steuerung',
      'Browser: the HUD has one labelled settings & controls button'
    )
    check(
      (await page.locator('.hud-top button', { hasText: '❓' }).count()) === 0 &&
        (await page.locator('.panel.help, .panel.settings').count()) === 0,
      'Browser: no separate help panel, settings popover or ❓ button'
    )
    await settingsButton.click()
    check(await dialog.isVisible(), 'Browser: the settings & controls dialog opens')
    const dialogText = await dialog.innerText()
    const expected = [
      'Name',
      'Look',
      'Konturen',
      'Vordere Wände absenken',
      'FPS-Anzeige',
      'W',
      '←',
      'Klick',
      'Hinsetzen / Aufstehen',
      'Benutzen',
      'Winken',
      'Jubeln',
      'Klatschen',
      'Herzen',
      'Hand heben / senken',
      'Mausrad',
      'Enter',
      'Chat',
    ]
    const missing = expected.filter((text) => !dialogText.includes(text))
    check(missing.length === 0, `Browser: the dialog has all settings and controls ${missing}`)
    check(
      !dialogText.includes('Leertaste') && !dialogText.includes('Hüpfen'),
      'Browser: the dialog no longer lists Leertaste / Hüpfen'
    )
    check(
      (await dialog.locator('input[type=checkbox]').count()) === 3 &&
        (await dialog.locator('select').count()) === 1,
      'Browser: the dialog has the three switches and the look select'
    )
    const box = await dialog.boundingBox()
    check(
      !!box &&
        Math.abs(box.x + box.width / 2 - 640) < 2 &&
        Math.abs(box.y + box.height / 2 - 400) < 2,
      `Browser: the dialog is centered (${JSON.stringify(box)})`
    )
    const stats = page.getByRole('checkbox', { name: 'FPS-Anzeige' })
    const statsBefore = await stats.isChecked()
    await stats.click()
    check(
      (await page.locator('#stats').count()) === (statsBefore ? 0 : 1),
      'Browser: a setting applies live (FPS display)'
    )
    await stats.click()
    const inModal = await position()
    await page.keyboard.down('KeyS')
    await page.waitForTimeout(500)
    await page.keyboard.up('KeyS')
    await page.keyboard.press('Digit1')
    const afterModalKeys = await position()
    check(
      Math.hypot(afterModalKeys.x - inModal.x, afterModalKeys.z - inModal.z) < 0.01,
      'Browser: movement keys do nothing while the dialog is open'
    )
    await dialog.locator('h2').click()
    check(await dialog.isVisible(), 'Browser: a click inside the dialog keeps it open')
    const nameInput = dialog.getByRole('textbox', { name: 'Name' })
    await nameInput.fill('Rauchtest2')
    await nameInput.press('Enter')
    await page.waitForTimeout(300)
    check(
      (await page.evaluate(() => localStorage.getItem('skyoffice3d.name'))) === 'Rauchtest2' &&
        (await page.locator('.tag .name', { hasText: 'Rauchtest2' }).count()) > 0,
      'Browser: Enter in the name field saves and sends the new name'
    )
    check(await dialog.isVisible(), 'Browser: saving the name keeps the dialog open')
    await page.keyboard.press('Escape')
    check(!(await dialog.isVisible()), 'Browser: Escape closes the dialog')
    await settingsButton.click()
    await dialog.getByRole('button', { name: 'Schließen (Esc)' }).click()
    check(!(await dialog.isVisible()), 'Browser: the close button closes the dialog')
    await settingsButton.click()
    await page.mouse.click(8, 8)
    check(!(await dialog.isVisible()), 'Browser: a click on the backdrop closes the dialog')

    // emotes: the five HUD buttons; with reduced motion, so the checks rely on the
    // data-fx DOM nodes alone and not on animation timing
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const emoteBar = page.locator('.hud-self .emotes')
    const emoteLabels = ['Winken', 'Jubeln', 'Klatschen', 'Herzen', 'Hand heben']
    const presentLabels = []
    for (const label of emoteLabels)
      if ((await emoteBar.getByRole('button', { name: label, exact: true }).count()) === 1)
        presentLabels.push(label)
    check(
      presentLabels.length === emoteLabels.length &&
        (await emoteBar.locator('button').count()) === emoteLabels.length,
      `Browser: the HUD has the five action buttons (${presentLabels.join(', ')})`
    )
    const hand = emoteBar.getByRole('button', { name: 'Hand heben', exact: true })
    const handMarker = page
      .locator('.tag', { has: page.locator('.name', { hasText: 'Rauchtest2' }) })
      .getByRole('img', { name: 'Hand gehoben' })
    const pressedBefore = await hand.getAttribute('aria-pressed')
    await hand.click()
    await handMarker.waitFor({ state: 'attached', timeout: 2000 }).catch(() => {})
    const pressedOn = await hand.getAttribute('aria-pressed')
    const markerOn = await handMarker.count()
    await hand.click()
    await handMarker.waitFor({ state: 'detached', timeout: 2000 }).catch(() => {})
    const pressedOff = await hand.getAttribute('aria-pressed')
    const markerOff = await handMarker.count()
    check(
      pressedBefore === 'false' &&
        pressedOn === 'true' &&
        markerOn === 1 &&
        pressedOff === 'false' &&
        markerOff === 0,
      `Browser: raise hand toggles on then off (aria-pressed ${pressedBefore} → ${pressedOn} → ${pressedOff}, marker ${markerOn} → ${markerOff})`
    )
    // waving is the arm alone (no data-fx); the other finite emotes rise above the name tag
    for (const [label, kind] of [
      ['Jubeln', 'cheer'],
      ['Klatschen', 'clap'],
      ['Herzen', 'hearts'],
    ]) {
      await page.waitForTimeout(1200) // past the emote cooldown (half an emote's duration)
      await emoteBar.getByRole('button', { name: label, exact: true }).click()
      const fx = await page
        .waitForFunction(
          ({ kind, name }) => {
            const tag = [...document.querySelectorAll('.tag')].find((t) =>
              t.querySelector('.name')?.textContent?.includes(name)
            )
            const node = tag?.querySelector(`[data-fx="${kind}"]`)
            if (!node) return null
            const nameBox = tag.querySelector('.name').getBoundingClientRect()
            return {
              particles: node.children.length,
              aboveName: node.getBoundingClientRect().bottom < nameBox.bottom,
              beforeName: !!(node.compareDocumentPosition(tag.querySelector('.name')) & 4),
            }
          },
          { kind, name: 'Rauchtest2' },
          { timeout: 2000 }
        )
        .then((handle) => handle.jsonValue())
        .catch(() => null)
      check(
        !!fx && fx.particles > 0 && fx.aboveName && fx.beforeName,
        `Browser: ${label} shows data-fx="${kind}" above my name tag (${JSON.stringify(fx)})`
      )
    }
    await page.emulateMedia({ reducedMotion: null })

    mkdirSync(path.dirname(screenshot), { recursive: true })
    await page.screenshot({ path: screenshot })
    console.log(`     screenshot: ${path.relative(process.cwd(), screenshot)}`)
    check(errors.length === 0, `Browser: no page or console errors ${errors.join('; ')}`)

    // a touch (coarse-pointer) context used to get an on-screen joystick; it was removed
    // in favour of tap-to-walk, so it must stay gone on mobile too
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      isMobile: true,
    })
    try {
      const mobilePage = await mobileContext.newPage()
      await mobilePage.goto(`${base}/?debug`)
      await mobilePage.fill('.join input', 'Rauchtest-Mobil')
      for (const label of ['Weiter', 'Weiter', 'Beitreten'])
        await mobilePage.click(`.join button.primary:has-text("${label}")`)
      await mobilePage.waitForSelector('.hud-top', { timeout: 15000 })
      check(
        (await mobilePage.locator('.joystick').count()) === 0,
        'Browser (mobile, touch): no on-screen joystick is rendered'
      )
      await mobilePage.waitForTimeout(700) // let the mobile follow-camera settle after joining
      const mobileStart = await mobilePage.evaluate(() => ({ x: __game.me.x, z: __game.me.z }))
      let mobileDistance = 0
      let mobileTapCount = 0
      for (const [x, y] of [
        [320, 360],
        [70, 360],
        [190, 250],
        [300, 450],
        [70, 500],
        [190, 500],
        [300, 250],
      ]) {
        mobileTapCount++
        await mobilePage.touchscreen.tap(x, y)
        await mobilePage.waitForTimeout(700)
        const mobilePosition = await mobilePage.evaluate(() => ({ x: __game.me.x, z: __game.me.z }))
        mobileDistance = Math.hypot(
          mobilePosition.x - mobileStart.x,
          mobilePosition.z - mobileStart.z
        )
        if (mobileDistance > 0.1) break
      }
      check(
        mobileDistance > 0.1,
        `Browser (mobile, touch): tapping the floor moves the player (${mobileDistance.toFixed(2)} tiles after ${mobileTapCount} tap(s))`
      )
      await mobilePage.getByRole('button', { name: 'Einstellungen & Steuerung' }).tap()
      const mobileDialog = mobilePage.getByRole('dialog', { name: /Einstellungen & Steuerung/ })
      check(await mobileDialog.isVisible(), 'Browser (mobile, touch): the settings dialog opens')
      const fit = await mobilePage.evaluate(() => {
        const dialog = document.querySelector('[role=dialog]').getBoundingClientRect()
        const body = document.querySelector('.settings-body')
        return {
          left: dialog.left,
          right: dialog.right,
          top: dialog.top,
          bottom: dialog.bottom,
          width: window.innerWidth,
          height: window.innerHeight,
          pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
          bodyOverflow: body.scrollWidth > body.clientWidth,
        }
      })
      check(
        fit.left >= 0 &&
          fit.top >= 0 &&
          fit.right <= fit.width &&
          fit.bottom <= fit.height &&
          !fit.pageOverflow &&
          !fit.bodyOverflow,
        `Browser (mobile, touch): the dialog fits the 375×667 screen (${JSON.stringify(fit)})`
      )
      await mobileDialog.getByRole('button', { name: 'Schließen (Esc)' }).scrollIntoViewIfNeeded()
      await mobileDialog.getByRole('button', { name: 'Schließen (Esc)' }).tap()
      check(
        !(await mobileDialog.isVisible()),
        'Browser (mobile, touch): the close button closes the dialog'
      )
    } finally {
      await mobileContext.close()
    }

    if (officeMap) await editorSmoke(browser)
    else check(false, 'Editor: no map from the server to test with')
  } catch (error) {
    check(false, `Browser: ${error?.message ?? error}`)
  } finally {
    await browser.close()
  }
}

stop()
process.exit(failed ? 1 : 0)
