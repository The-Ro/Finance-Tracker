// Square photo cropping (profile pictures): the photo fills a square frame of
// side `view`, can be zoomed (1 = just covers the frame) and dragged; these
// keep it covering the frame and turn the result into a source rectangle.

export interface CropState {
  /** Top-left of the drawn photo, relative to the frame (always <= 0). */
  x: number
  y: number
  /** 1 = the photo just covers the frame; up to `MAX_ZOOM`. */
  zoom: number
}

export const MAX_ZOOM = 4

/** Pixels on screen per pixel of the photo at this zoom. */
export function scaleFor(view: number, width: number, height: number, zoom: number): number {
  return (view / Math.min(width, height)) * zoom
}

/** Keeps the photo covering the frame (no empty edges). */
export function clampCrop(s: CropState, view: number, width: number, height: number): CropState {
  const scale = scaleFor(view, width, height, s.zoom)
  const minX = view - width * scale
  const minY = view - height * scale
  return { zoom: s.zoom, x: Math.min(0, Math.max(minX, s.x)), y: Math.min(0, Math.max(minY, s.y)) }
}

/** Starting position: zoom 1, centred. */
export function initialCrop(view: number, width: number, height: number): CropState {
  const scale = scaleFor(view, width, height, 1)
  return { zoom: 1, x: (view - width * scale) / 2, y: (view - height * scale) / 2 }
}

/** Zooms keeping the frame's centre on the same spot of the photo. */
export function zoomCrop(s: CropState, zoom: number, view: number, width: number, height: number): CropState {
  const z = Math.min(MAX_ZOOM, Math.max(1, zoom))
  const before = scaleFor(view, width, height, s.zoom)
  const after = scaleFor(view, width, height, z)
  const cx = (view / 2 - s.x) / before
  const cy = (view / 2 - s.y) / before
  return clampCrop({ zoom: z, x: view / 2 - cx * after, y: view / 2 - cy * after }, view, width, height)
}

/** The square of the photo (in its own pixels) the frame shows. */
export function cropSource(s: CropState, view: number, width: number, height: number): { sx: number; sy: number; size: number } {
  const scale = scaleFor(view, width, height, s.zoom)
  // "|| 0" turns -0 into 0.
  return { sx: -s.x / scale || 0, sy: -s.y / scale || 0, size: view / scale }
}
