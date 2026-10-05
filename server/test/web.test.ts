import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import { clientConfig, configScript, serveClient } from '../web.ts'

describe('clientConfig', () => {
  it('uses the origin of the page when no URL is set', () => {
    expect(clientConfig({})).toEqual({ serverUrl: '' })
    expect(clientConfig({ PUBLIC_SERVER_URL: '  ' })).toEqual({ serverUrl: '' })
  })

  it('passes on a ws(s) URL', () => {
    expect(clientConfig({ PUBLIC_SERVER_URL: 'wss://office.example.test' })).toEqual({
      serverUrl: 'wss://office.example.test',
    })
  })

  it('refuses anything else, so nothing can be injected into config.js', () => {
    for (const bad of ['https://example.test', 'office.example.test', 'wss://a"</script>']) {
      expect(() => clientConfig({ PUBLIC_SERVER_URL: bad })).toThrow(/PUBLIC_SERVER_URL/)
    }
  })

  it('writes a script that sets the configuration', () => {
    const window: Record<string, unknown> = {}
    new Function('window', configScript({ serverUrl: 'ws://x.test:1' }))(window)
    expect(window.__VIRTUALOFFICE_CONFIG__).toEqual({ serverUrl: 'ws://x.test:1' })
  })
})

describe('serveClient', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'client-'))
  mkdirSync(path.join(dir, 'assets'))
  writeFileSync(path.join(dir, 'index.html'), '<div id="root"></div>')
  writeFileSync(path.join(dir, 'config.js'), '// the empty file of the build')
  writeFileSync(path.join(dir, 'assets', 'index-abc123.js'), 'console.log(1)')

  let base = ''
  let close = () => {}
  beforeAll(async () => {
    const app = express()
    serveClient(app, dir, { PUBLIC_SERVER_URL: 'wss://office.example.test' })
    const server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    close = () => server.close()
  })
  afterAll(() => close())

  it('serves index.html, never cached', async () => {
    const res = await fetch(`${base}/`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('id="root"')
    expect(res.headers.get('cache-control')).toBe('no-cache')
  })

  it('replaces the config.js of the build with the configuration', async () => {
    const res = await fetch(`${base}/config.js`)
    expect(res.headers.get('content-type')).toMatch(/javascript/)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).toContain('"serverUrl":"wss://office.example.test"')
  })

  it('caches the hashed bundles for long', async () => {
    const res = await fetch(`${base}/assets/index-abc123.js`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('immutable')
  })

  it('refuses to start without a built client', () => {
    expect(() => serveClient(express(), path.join(dir, 'assets'), {})).toThrow(/index.html/)
  })
})
