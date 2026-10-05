// the starting (and wheel-reset) orthographic zoom for the follow camera.
// a smaller zoom shows more of the scene: mobile screens get zoomed out further so
// more of the office stays visible, in both portrait and landscape orientations.
export const ZOOM_DEFAULT = 88
export const ZOOM_DEFAULT_MOBILE = 44

export function defaultZoom(touch: boolean) {
  return touch ? ZOOM_DEFAULT_MOBILE : ZOOM_DEFAULT
}
