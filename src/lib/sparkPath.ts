// Turns a short series of values into SVG path data for a smooth line
// chart: the stroke, the filled area under it, and each point's position.
// Used by the auth pages' decorative savings line (AuthShowcase.tsx); pure
// so the geometry is unit-tested instead of hand-tuned coordinates.

export interface SparkPoint {
  x: number
  y: number
  value: number
}

export interface SparkPath {
  /** Smooth line through every point (cubic Bezier segments). */
  line: string
  /** The line closed down to the baseline, for a gradient fill. */
  area: string
  points: SparkPoint[]
  /** y of the zero line, clamped into the plot; null when zero is out of range. */
  zeroY: number | null
}

export interface SparkPathOptions {
  width: number
  height: number
  /** Horizontal inset so end points (and their dots) aren't clipped. */
  padX?: number
  /** Vertical inset, same reason. */
  padY?: number
}

const round = (n: number) => Math.round(n * 100) / 100

export function sparkPath(values: number[], { width, height, padX = 0, padY = 0 }: SparkPathOptions): SparkPath {
  if (values.length === 0) return { line: '', area: '', points: [], zeroY: null }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const innerW = Math.max(0, width - padX * 2)
  const innerH = Math.max(0, height - padY * 2)
  const step = values.length > 1 ? innerW / (values.length - 1) : 0

  // A flat series sits in the vertical middle rather than on an edge.
  const yFor = (v: number) => (span === 0 ? padY + innerH / 2 : padY + ((max - v) / span) * innerH)

  const points = values.map((value, i) => ({
    x: round(values.length > 1 ? padX + i * step : width / 2),
    y: round(yFor(value)),
    value,
  }))

  let line = `M${points[0].x} ${points[0].y}`
  // Catmull-Rom to cubic Bezier (tension 1/6): each segment's control points
  // follow the neighbouring points' slope, so the curve passes through every
  // point without overshooting wildly.
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = round(p1.x + (p2.x - p0.x) / 6)
    const c1y = round(p1.y + (p2.y - p0.y) / 6)
    const c2x = round(p2.x - (p3.x - p1.x) / 6)
    const c2y = round(p2.y - (p3.y - p1.y) / 6)
    line += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`
  }

  const first = points[0]
  const last = points[points.length - 1]
  const baseY = round(height - padY)
  const area = `${line} L${last.x} ${baseY} L${first.x} ${baseY} Z`

  const zeroY = min <= 0 && max >= 0 ? round(yFor(0)) : null

  return { line, area, points, zeroY }
}
