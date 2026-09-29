// Measures FPS and draw calls of the 3D client in a real (headless) Chromium with GPU.
// Needs the dev server (it teleports via the window.__game debug hook) and a server;
// start bots first for the crowded scenarios (scripts/bots.mjs).
//
//   CHROME_PATH=/usr/bin/chromium node client-3d/scripts/measure.mjs [url] [label]
/* global document, window, __game -- used inside page.evaluate(), which runs in the browser */
import { chromium } from 'playwright-core'

const url = process.argv[2] ?? 'http://localhost:3100/'
const label = process.argv[3] ?? ''
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium-browser',
  // use the real GPU; swiftshader (software) numbers are meaningless
  // without vsync and frame rate limit, so the FPS show the headroom above 60
  args: [
    '--enable-gpu',
    '--use-angle=vulkan',
    '--ignore-gpu-blocklist',
    '--disable-gpu-vsync',
    '--disable-frame-rate-limit',
  ],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.goto(url)
await page.waitForTimeout(1500)

const renderer = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const ext = gl?.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
})

async function sample(name, seconds = 8) {
  await page.waitForTimeout(2000)
  const samples = []
  for (let i = 0; i < seconds * 2; i++) {
    await page.waitForTimeout(500)
    const p = await page.evaluate(() => window.__perf)
    if (p) samples.push(p)
  }
  const avg = (k) => Math.round(samples.reduce((s, p) => s + p[k], 0) / samples.length)
  const result = {
    scenario: name,
    fpsAvg: avg('fps'),
    fpsMin: Math.min(...samples.map((p) => p.fps)),
    drawCalls: avg('calls'),
    triangles: avg('triangles'),
    chibis: avg('players'),
  }
  console.log(JSON.stringify(result))
  return result
}

const setSettings = (patch) =>
  page.evaluate((patch) => {
    const key = 'skyoffice3d.settings'
    const s = JSON.parse(localStorage.getItem(key) ?? '{"state":{}}')
    Object.assign(s.state, patch)
    localStorage.setItem(key, JSON.stringify(s))
  }, patch)

console.log(`renderer: ${renderer} ${label}`)
await setSettings({ stats: true, outlines: true, postFx: 'off', lowWalls: true })
await page.reload()
await page.waitForTimeout(1500)
await sample('overview (not joined, whole office)')

await page.fill('.join input', 'Messung')
await page.click('button.primary')
await page.waitForTimeout(1500)
await sample('joined, corridor')

// into the conference room, where the bots are
await page.evaluate(() => {
  __game.me.x = 9.5
  __game.me.z = 24
})
await sample('conference room')

for (const [name, patch] of [
  ['conference room, outlines off', { outlines: false }],
  ['conference room, pixel post-fx', { outlines: true, postFx: 'pixel' }],
  ['conference room, edge post-fx', { outlines: false, postFx: 'outline' }],
]) {
  await page.evaluate((patch) => window.__settings?.setState(patch), patch)
  await sample(name)
}
await browser.close()
