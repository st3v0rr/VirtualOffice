// Models of the map are loaded only from the client's own models/ folder. The map file
// can't point anywhere else (see checkModelSource), and this also stops the files a .gltf
// refers to (buffers, textures) from leaving it. Embedded data (data:/blob: URLs) is local.
export function isLocalModelUrl(url: string, pageUrl: string, base = '/') {
  let resolved: URL
  let page: URL
  try {
    page = new URL(pageUrl)
    resolved = new URL(url, page)
  } catch {
    return false
  }
  if (resolved.protocol === 'data:') return true
  if (resolved.protocol === 'blob:') return url.startsWith(`blob:${page.origin}/`)
  // URL() has already resolved "..", also when written as %2e%2e
  const root = new URL(`${base.replace(/\/?$/, '/')}models/`, page.origin)
  return resolved.origin === page.origin && resolved.pathname.startsWith(root.pathname)
}
