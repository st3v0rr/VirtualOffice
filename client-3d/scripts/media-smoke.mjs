// Smoke test of the video chat UI in a headless Chromium with fake camera/microphone:
// join, set up the devices, toggle the microphone and camera, walk into the library.
// Works without a LiveKit server (then the HUD says the video chat is unavailable).
// Needs the Colyseus server and the 3D dev server (npm run dev).
//
//   CHROME_PATH=/usr/bin/chromium node client-3d/scripts/media-smoke.mjs [url]
/* global document, __game -- used inside page.evaluate(), which runs in the browser */
import { chromium } from 'playwright-core'

const url3d = process.argv[2] ?? 'http://localhost:3100/'
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium-browser',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})
const context = await browser.newContext({ viewport: { width: 1400, height: 850 } })
// FRESH=1: like a first visit, the camera/microphone are set up in the dialog
if (!process.env.FRESH) await context.grantPermissions(['camera', 'microphone'])

let failed = false
const check = (ok, text) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`)
  if (!ok) failed = true
}
const watch = (page, name) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`))
  return errors
}
const pillText = (page) =>
  page.evaluate(() => [...document.querySelectorAll('.hud-top .pill')].map((p) => p.textContent))

// ---- 3D client ----
const page = await context.newPage()
const errors3d = watch(page, '3D')
await page.goto(url3d)
await page.fill('.join input', 'Rauchtest')
// the join screen: name, room (public office), camera/microphone (off), then Beitreten
for (const label of ['Weiter', 'Weiter', 'Beitreten'])
  await page.click(`.join button.primary:has-text("${label}")`)
await page.waitForSelector('.hud-top', { timeout: 10000 })
check(true, '3D: joined the office')

// the camera/microphone were granted before, so the client picks them up by itself
await page.waitForSelector('.pill.button.toggle', { timeout: 8000 }).catch(() => null)
let toggles = await page.$$('.pill.button.toggle')
if (!toggles.length) {
  await page.click('.pill.button.media-setup')
  const allow = await page.waitForSelector('.media-dialog button.primary', { timeout: 3000 })
  if ((await allow.textContent())?.includes('freigeben')) await allow.click()
  await page.waitForSelector('.media-dialog video', { timeout: 8000 })
  check(true, '3D: setup dialog shows the camera preview')
  await page.click('.media-dialog .toolbar button.primary')
  await page.waitForSelector('.pill.button.toggle', { timeout: 5000 })
  toggles = await page.$$('.pill.button.toggle')
}
check(toggles.length === 2, '3D: microphone and camera toggles in the HUD')

const micOff = async () => (await toggles[0].getAttribute('class')).includes('off')
await toggles[0].click()
check(await micOff(), '3D: microphone muted')
await toggles[0].click()
check(!(await micOff()), '3D: microphone on again')
await toggles[1].click()
check((await toggles[1].getAttribute('class')).includes('off'), '3D: camera off')
await toggles[1].click()

// my own tile in the video grid
check((await page.$$('.video-grid .video-tile')).length >= 1, '3D: own video tile shown')

// without LiveKit the video chat gives up after a few seconds and the office keeps working
// (it retries every 10 s and shows "verbinde …" for a moment then, so wait for the result)
await page
  .waitForFunction(
    () =>
      [...document.querySelectorAll('.hud-top .pill')].some((p) =>
        /Video-Chat|Publikum/.test(p.textContent ?? '')
      ),
    null,
    { timeout: 12000 }
  )
  .catch(() => null)
const pills = await pillText(page)
console.log('     HUD:', pills.join(' | '))
check(
  pills.some((p) => /Video-Chat/.test(p)),
  '3D: video chat status shown (connected or unavailable)'
)

// the settings dialog opens again with devices
await page.click('.pill.button[title^="Kamera, Mikrofon"]')
await page.waitForSelector('.media-dialog select', { timeout: 5000 })
check(true, '3D: device settings open again')
await page.click('.media-dialog .toolbar button.secondary')

// walk into the library (quiet zone)
await page.evaluate(() => {
  __game.me.x = 12
  __game.me.z = 31
})
await page.waitForTimeout(1500)
check(
  (await pillText(page)).some((p) => p.includes('Ruhezone')),
  '3D: quiet zone in the library'
)
await page.evaluate(() => {
  __game.me.x = 24
  __game.me.z = 12
})
await page.waitForTimeout(1000)
check(!(await pillText(page)).some((p) => p.includes('Ruhezone')), '3D: quiet zone left')

// the computer dialog opens and answers without LiveKit
const computer = await page.evaluate(() => __game.computers[0]?.id)
await page.evaluate(
  (id) => __game.useGame.getState().set({ dialog: { kind: 'computer', id } }),
  computer
)
await page.waitForSelector('.modal h2', { timeout: 3000 })
await page.waitForTimeout(6000)
const computerText = await page.textContent('.modal')
check(/nicht verfügbar|teilen/.test(computerText ?? ''), '3D: computer dialog answers')
await page.keyboard.press('Escape')

await page.screenshot({ path: process.env.SCREENSHOT ?? '/tmp/media-smoke-3d.png' })
check(errors3d.length === 0, `3D: no page errors ${errors3d.join('; ')}`)

await browser.close()
process.exit(failed ? 1 : 0)
