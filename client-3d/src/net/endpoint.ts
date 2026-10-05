// set at run time by /config.js when the server serves the built client (Docker image)
declare global {
  interface Window {
    __VIRTUALOFFICE_CONFIG__?: { serverUrl?: string }
  }
}

// the WebSocket URL of the Colyseus server
export function serverEndpoint() {
  const protocol = window.location.protocol.replace('http', 'ws')
  const config = window.__VIRTUALOFFICE_CONFIG__
  // served by the Colyseus server: its URL, or else the same host and port as the page
  if (config) return config.serverUrl || `${protocol}//${window.location.host}`
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL as string
  // dev server: the Colyseus server on the same host
  return `${protocol}//${window.location.hostname}:2567`
}

// the same server over HTTP, e.g. for /map.json
export const serverHttpUrl = (endpoint = serverEndpoint()) =>
  endpoint.replace(/^ws/, 'http').replace(/\/+$/, '')
