import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import { formatMap } from '../../types/map/serialize.ts'
import { MapValidationError, parseMap } from '../../types/map/validate.ts'
import { findMapFile, loadMapFile, officeMap, officeMapData, officeMapFile } from '../officeMap.ts'
import { serveMap } from '../web.ts'

const dir = mkdtempSync(path.join(tmpdir(), 'office-map-'))
const write = (name: string, content: string) => {
  const file = path.join(dir, name)
  writeFileSync(file, content)
  return file
}

describe('the office map of the server', () => {
  it('is assets/map/office.json, read and checked at start', () => {
    expect(officeMapFile).toMatch(/assets[\\/]map[\\/]office\.json$/)
    expect(officeMapData.format).toBe('virtualoffice-map')
    expect(officeMap.computerIds).toEqual(['875', '876', '877', '878', '879'])
    expect(officeMap.spawn).toEqual({ x: 1153, y: 500 })
    expect(officeMap.zones.map((z) => z.type).sort()).toEqual([
      'auditorium',
      'meeting',
      'quiet',
      'stage',
    ])
  })

  it('refuses to start with a broken map and names every problem', () => {
    const map = structuredClone(officeMapData) as Record<string, any>
    map.spawn = { x: 0.5, y: 0.5 }
    map.placements[0].asset = 'sofa'
    const file = write('broken.json', JSON.stringify(map))
    expect(() => loadMapFile(file)).toThrow(MapValidationError)
    expect(() => loadMapFile(file)).toThrow(
      new RegExp(
        `Invalid office map ${file.replace(/[\\/.]/g, '\\$&')}:\\n  - spawn: .*\\n  - placements\\[0\\]\\.asset: unknown asset "sofa"`
      )
    )
    expect(() =>
      loadMapFile(write('tiled.json', '{"tiledversion":"1.7","layers":[],"tilesets":[]}'))
    ).toThrow(/Tiled map/)
    expect(() => loadMapFile(write('nojson.json', 'map:'))).toThrow(/not valid JSON/)
  })

  it('takes OFFICE_MAP_PATH, else searches assets/map/office.json upwards', () => {
    expect(findMapFile({ OFFICE_MAP_PATH: '/srv/maps/office.json' })).toBe('/srv/maps/office.json')
    const repo = path.join(dir, 'repo')
    mkdirSync(path.join(repo, 'assets', 'map'), { recursive: true })
    mkdirSync(path.join(repo, 'server', 'lib', 'server'), { recursive: true })
    writeFileSync(path.join(repo, 'assets', 'map', 'office.json'), '{}')
    expect(findMapFile({}, path.join(repo, 'server', 'lib', 'server'))).toBe(
      path.join(repo, 'assets', 'map', 'office.json')
    )
    expect(() => findMapFile({}, path.parse(dir).root)).toThrow(/OFFICE_MAP_PATH/)
  })
})

describe('GET /map.json', () => {
  let base = ''
  let close = () => {}
  beforeAll(async () => {
    const app = express()
    serveMap(app, officeMapData)
    const server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    close = () => server.close()
  })
  afterAll(() => close())

  it('serves the map the server uses, never cached', async () => {
    const res = await fetch(`${base}/map.json`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect(res.headers.get('cache-control')).toBe('no-cache')
    const text = await res.text()
    expect(text).toBe(formatMap(officeMapData))
    const parsed = parseMap(text)
    expect(parsed.ok && parsed.map).toEqual(officeMapData)
  })

  it('is read-only: nothing can be written to it', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const res = await fetch(`${base}/map.json`, {
        method,
        body: method === 'DELETE' ? undefined : '{}',
      })
      expect(res.status, method).toBe(404)
    }
  })
})
