import path from 'node:path'
import { existsSync } from 'node:fs'
import express, { type Application } from 'express'

// The built 3D client, served by the Colyseus server itself when STATIC_DIR is set
// (the Docker image does that), so one process and one port serve page and WebSocket.

export type ClientConfig = {
  // WebSocket URL of this server as the browser sees it; '' = the origin of the page
  serverUrl: string
}

export function clientConfig(env: NodeJS.ProcessEnv): ClientConfig {
  const serverUrl = env.PUBLIC_SERVER_URL?.trim() ?? ''
  if (serverUrl && !/^wss?:\/\/[^\s"'<>]+$/.test(serverUrl)) {
    throw new Error(`PUBLIC_SERVER_URL must be a ws:// or wss:// URL, got "${serverUrl}"`)
  }
  return { serverUrl }
}

// /config.js, loaded by index.html before the app: the configuration at run time, so
// one image works behind any host name or proxy
export function configScript(config: ClientConfig) {
  return `window.__VIRTUALOFFICE_CONFIG__ = ${JSON.stringify(config)}\n`
}

export function serveClient(app: Application, staticDir: string, env: NodeJS.ProcessEnv) {
  const dir = path.resolve(staticDir)
  if (!existsSync(path.join(dir, 'index.html'))) {
    throw new Error(`STATIC_DIR ${dir} has no index.html, build the client first`)
  }
  const script = configScript(clientConfig(env))
  app.get('/config.js', (_req, res) => {
    res.type('application/javascript').set('Cache-Control', 'no-store').send(script)
  })
  app.use(
    express.static(dir, {
      index: 'index.html',
      setHeaders: (res, file) => {
        // the bundles have a hash in their name, index.html must always be fresh
        if (file.includes(`${path.sep}assets${path.sep}`)) {
          res.set('Cache-Control', 'public, max-age=31536000, immutable')
        } else {
          res.set('Cache-Control', 'no-cache')
        }
      },
    })
  )
}
