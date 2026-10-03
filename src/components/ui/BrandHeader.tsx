import { useId, useLayoutEffect, useRef, useState } from 'react'

interface BrandHeaderProps {
  /** Shows the "Effortless money management" tagline underneath the
   *  wordmark -- only the auth pages (a first impression, plenty of room)
   *  use this; compact in-app spots (the floating nav pill) don't. */
  tagline?: boolean
}

// Glyph outlines of "Rs" in Fraunces Bold Italic, pre-converted to paths so
// the mark never depends on a font being loaded. RS_PATH is size 40 centered
// on x=60 (by advance width), baseline 72; RS_SMALL_PATH is size 52 on
// baseline 78, for marks under 40px where the ring and flourish drop out.
// Regenerate (and the PWA icons) with the opentype.js + resvg script
// described in CLAUDE.md's branding section.
const RS_PATH = 'M57.32 60.68L58.80 65.72Q59 66.40 59.25 66.85Q59.50 67.30 59.81 67.51Q60.12 67.72 60.50 67.72Q60.92 67.72 61.30 67.48Q61.68 67.24 62.08 66.82Q62.26 66.66 62.54 66.58Q62.82 66.50 63.04 66.60Q63.46 66.74 63.57 67.14Q63.68 67.54 63.44 68.10Q62.56 70.18 60.70 71.37Q58.84 72.56 56.56 72.56Q55.48 72.56 54.69 72.22Q53.90 71.88 53.36 71.11Q52.82 70.34 52.48 69.10L50.56 61.62Q48.76 61.60 47.46 61.26Q47.18 62.32 46.92 63.30Q46.50 64.92 46.20 66.15Q45.90 67.38 45.78 67.98Q45.60 68.68 45.78 68.93Q45.96 69.18 46.32 69.34L47.22 69.62Q47.62 69.82 47.86 70.09Q48.10 70.36 48.10 70.76Q48.10 71.32 47.71 71.66Q47.32 72 46.54 72L36.70 72Q35.94 72 35.66 71.69Q35.38 71.38 35.38 70.92Q35.38 70.42 35.69 70.11Q36 69.80 36.42 69.64L37.40 69.40Q37.88 69.26 38.14 68.95Q38.40 68.64 38.60 68.04Q38.74 67.56 39.06 66.37Q39.38 65.18 39.81 63.56Q40.24 61.94 40.74 60.08Q41.24 58.22 41.73 56.36Q42.22 54.50 42.64 52.86Q43.06 51.22 43.36 50.02Q43.66 48.82 43.76 48.30Q43.96 47.48 43.93 47.12Q43.90 46.76 43.32 46.54L42.38 46.30Q41.98 46.12 41.77 45.87Q41.56 45.62 41.56 45.26Q41.56 44.70 41.97 44.35Q42.38 44 43.12 44L54.58 44Q58.22 44 60.69 45.14Q63.16 46.28 64.23 48.37Q65.30 50.46 64.68 53.34Q64.18 55.82 62.38 57.67Q60.58 59.52 57.74 60.54Q57.54 60.62 57.32 60.68M48.78 56.24L48 59.20Q48.18 59.24 48.38 59.28Q49.42 59.54 50.68 59.54Q52.60 59.54 54.03 58.67Q55.46 57.80 56.38 56.19Q57.30 54.58 57.64 52.40Q57.98 50.24 57.53 48.87Q57.08 47.50 56.08 46.83Q55.08 46.16 53.74 46.16Q52.42 46.16 51.83 46.72Q51.24 47.28 50.92 48.28Q50.76 48.84 50.43 50.04Q50.10 51.24 49.68 52.84Q49.26 54.44 48.78 56.24M73.64 70.34Q74.64 70.34 75.23 69.80Q75.82 69.26 75.82 68.40Q75.82 67.80 75.55 67.30Q75.28 66.80 74.55 66.23Q73.82 65.66 72.38 64.84Q70.76 63.92 69.79 63.09Q68.82 62.26 68.38 61.33Q67.94 60.40 67.94 59.20Q67.94 57.48 69.06 56.04Q70.18 54.60 72.29 53.72Q74.40 52.84 77.46 52.84Q79.84 52.84 81.40 53.43Q82.96 54.02 83.74 55.04Q84.52 56.06 84.52 57.36Q84.54 58.60 84.03 59.27Q83.52 59.94 82.60 59.94Q81.74 59.94 81.12 59.39Q80.50 58.84 79.86 57.44Q79.22 56.20 78.44 55.57Q77.66 54.94 76.64 54.94Q75.64 54.94 75.06 55.46Q74.48 55.98 74.48 56.90Q74.48 57.46 74.75 58.01Q75.02 58.56 75.77 59.22Q76.52 59.88 77.94 60.78Q79.74 61.86 80.71 62.75Q81.68 63.64 82.05 64.53Q82.42 65.42 82.42 66.56Q82.42 68.32 81.26 69.66Q80.10 71 78.01 71.77Q75.92 72.54 73.10 72.54Q70.42 72.54 68.73 71.88Q67.04 71.22 66.25 70.13Q65.46 69.04 65.46 67.76Q65.50 66.64 66 65.98Q66.50 65.32 67.40 65.32Q68.42 65.32 69.10 65.96Q69.78 66.60 70.38 67.90Q71.12 69.28 71.90 69.81Q72.68 70.34 73.64 70.34'
const RS_SMALL_PATH = 'M56.52 63.28L58.44 69.84Q58.70 70.72 59.03 71.31Q59.35 71.89 59.75 72.16Q60.16 72.44 60.65 72.44Q61.20 72.44 61.69 72.12Q62.18 71.81 62.70 71.27Q62.94 71.06 63.30 70.95Q63.67 70.85 63.95 70.98Q64.50 71.16 64.64 71.68Q64.78 72.20 64.47 72.93Q63.33 75.63 60.91 77.18Q58.49 78.73 55.53 78.73Q54.12 78.73 53.10 78.29Q52.07 77.84 51.37 76.84Q50.67 75.84 50.22 74.23L47.73 64.51Q45.39 64.48 43.70 64.04Q43.33 65.42 43 66.69Q42.45 68.80 42.06 70.39Q41.67 71.99 41.51 72.77Q41.28 73.68 41.51 74.01Q41.75 74.33 42.22 74.54L43.39 74.91Q43.91 75.17 44.22 75.52Q44.53 75.87 44.53 76.39Q44.53 77.12 44.02 77.56Q43.52 78 42.50 78L29.71 78Q28.72 78 28.36 77.60Q27.99 77.19 27.99 76.60Q27.99 75.95 28.40 75.54Q28.80 75.14 29.35 74.93L30.62 74.62Q31.24 74.44 31.58 74.03Q31.92 73.63 32.18 72.85Q32.36 72.23 32.78 70.68Q33.19 69.13 33.75 67.03Q34.31 64.92 34.96 62.50Q35.61 60.09 36.25 57.67Q36.89 55.25 37.43 53.12Q37.98 50.99 38.37 49.43Q38.76 47.87 38.89 47.19Q39.15 46.12 39.11 45.66Q39.07 45.19 38.32 44.90L37.09 44.59Q36.57 44.36 36.30 44.03Q36.03 43.71 36.03 43.24Q36.03 42.51 36.56 42.05Q37.09 41.60 38.06 41.60L52.95 41.60Q57.69 41.60 60.90 43.08Q64.11 44.56 65.50 47.28Q66.89 50 66.08 53.74Q65.43 56.97 63.09 59.37Q60.75 61.78 57.06 63.10Q56.80 63.21 56.52 63.28M45.41 57.51L44.40 61.36Q44.63 61.41 44.89 61.46Q46.25 61.80 47.88 61.80Q50.38 61.80 52.24 60.67Q54.10 59.54 55.29 57.45Q56.49 55.35 56.93 52.52Q57.37 49.71 56.79 47.93Q56.20 46.15 54.90 45.28Q53.60 44.41 51.86 44.41Q50.15 44.41 49.38 45.14Q48.61 45.86 48.20 47.16Q47.99 47.89 47.56 49.45Q47.13 51.01 46.58 53.09Q46.04 55.17 45.41 57.51M77.73 75.84Q79.03 75.84 79.80 75.14Q80.57 74.44 80.57 73.32Q80.57 72.54 80.22 71.89Q79.86 71.24 78.92 70.50Q77.97 69.76 76.09 68.69Q73.99 67.50 72.73 66.42Q71.47 65.34 70.89 64.13Q70.32 62.92 70.32 61.36Q70.32 59.12 71.78 57.25Q73.23 55.38 75.98 54.24Q78.72 53.09 82.70 53.09Q85.79 53.09 87.82 53.86Q89.85 54.63 90.86 55.95Q91.88 57.28 91.88 58.97Q91.90 60.58 91.24 61.45Q90.58 62.32 89.38 62.32Q88.26 62.32 87.46 61.61Q86.65 60.89 85.82 59.07Q84.99 57.46 83.97 56.64Q82.96 55.82 81.63 55.82Q80.33 55.82 79.58 56.50Q78.82 57.17 78.82 58.37Q78.82 59.10 79.18 59.81Q79.53 60.53 80.50 61.39Q81.48 62.24 83.32 63.41Q85.66 64.82 86.92 65.97Q88.18 67.13 88.67 68.29Q89.15 69.45 89.15 70.93Q89.15 73.22 87.64 74.96Q86.13 76.70 83.41 77.70Q80.70 78.70 77.03 78.70Q73.55 78.70 71.35 77.84Q69.15 76.99 68.13 75.57Q67.10 74.15 67.10 72.49Q67.15 71.03 67.80 70.17Q68.45 69.32 69.62 69.32Q70.95 69.32 71.83 70.15Q72.71 70.98 73.49 72.67Q74.46 74.46 75.47 75.15Q76.48 75.84 77.73 75.84'
const FLOURISH_PATH = 'M38 84C48 80 66 90 84 82'

type Cutout = 'card' | 'bg'

// The ring, Rs and flourish are painted with a per-coin gradient whose stop
// colours come from index.css (.brand-coin-mark-*): light gold on the gold
// coin, and the surface colour (a cut-out) when the coin follows the theme.
const MARK_STOP_SURFACE: Record<Cutout, string> = { card: '', bg: ' brand-coin-mark--bg' }

interface BrandMarkProps {
  className?: string
  size?: 'sm' | 'md'
  /** The surface the coin sits on. On a theme-coloured coin the ring, Rs and
   *  flourish are "cut out" of it by painting them in that surface's colour;
   *  on the gold coin they're light gold. */
  cutout?: Cutout
}

/** The coin: a gold coin with the Signature Rs, an inner ring and a flourish
 *  raised on it in light gold. With "My theme" (and on the sign-in pages) the
 *  coin takes the accent colour and the marks become cut-outs in the colour
 *  of the surface underneath (`cutout`).
 *
 *  Motion (index.css, .brand-coin rules, reduced-motion safe): on mount the
 *  coin rolls in, the ring fills clockwise from 12 o'clock and the flourish
 *  draws; a soft shimmer then sweeps across three times and stops. Hovering
 *  or tapping it flips it once.
 *
 *  `size` picks the artwork, not the box (className sets the box): 'sm' is
 *  for anything rendered under 40px -- no ring, no flourish, bigger letters,
 *  and only the roll-in. The default box is 36px, so the default size is
 *  'sm'; pass size="md" with a 40px+ box. */
// The intro (roll-in, ring fill, flourish, shimmer) plays once per app load,
// on the first mark that is actually on screen. Marks that mount later -- the
// phone menu button re-creates the coin every time the menu closes, and pages
// remount on navigation -- show it complete and still, so the coin never
// re-rolls from off-screen or flickers. "On screen" matters: the desktop
// sidebar is always mounted (just display:none below lg) and mounts first, so
// claiming the intro on mount let that hidden coin use it up and the phone's
// coin never shimmered at all.
let introPlayed = false

export function BrandMark({ className = 'h-9 w-9', size = 'sm', cutout = 'card' }: BrandMarkProps) {
  const small = size === 'sm'
  // useId gives ":r1:"-style ids; colons don't survive inside url(#...).
  const uid = `bm${useId().replace(/:/g, '')}`
  const mark = `url(#${uid}-mark)`
  const [flipping, setFlipping] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const [intro, setIntro] = useState(false)
  // Layout effect: decided before the first paint, so a coin that gets the
  // intro never shows a finished frame first. getClientRects() is empty for
  // anything inside a display:none ancestor.
  useLayoutEffect(() => {
    if (introPlayed || !ref.current || ref.current.getClientRects().length === 0) return
    introPlayed = true
    setIntro(true)
  }, [])

  return (
    <span
      ref={ref}
      className={`brand-coin${intro ? ' brand-coin--intro' : ''} inline-flex shrink-0 ${className}`}
      aria-hidden="true"
      onPointerEnter={small ? undefined : (e) => e.pointerType === 'mouse' && setFlipping(true)}
    >
      <svg
        viewBox="0 0 120 120"
        className={`brand-coin-face h-full w-full${flipping ? ' is-flipping' : ''}`}
        onAnimationEnd={(e) => {
          if (e.animationName === 'brand-coin-flip') setFlipping(false)
        }}
      >
        <defs>
          <linearGradient id={`${uid}-mark`} x1="0.2" y1="0.1" x2="0.8" y2="0.9">
            <stop offset="0%" className={`brand-coin-mark-hi${MARK_STOP_SURFACE[cutout]}`} />
            <stop offset="100%" className={`brand-coin-mark-lo${MARK_STOP_SURFACE[cutout]}`} />
          </linearGradient>
          {!small && (
            <>
            <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${uid}-clip`}>
              <circle cx="60" cy="60" r="60" />
            </clipPath>
            {/* Metallic shading over the flat coin colour: a highlight top-left
                fading to a darker rim bottom-right, so the gold reads as gold,
                not flat yellow. */}
            <linearGradient id={`${uid}-metal`} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
              <stop offset="0%" stopColor="#FFF6DC" stopOpacity="0.55" />
              <stop offset="38%" stopColor="#FFF6DC" stopOpacity="0.08" />
              <stop offset="62%" stopColor="#3B2604" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#3B2604" stopOpacity="0.38" />
            </linearGradient>
            </>
          )}
        </defs>
        <circle className="fill-coin" cx="60" cy="60" r="60" />
        {!small && <circle cx="60" cy="60" r="60" fill={`url(#${uid}-metal)`} />}
        {!small && (
          <circle
            className="brand-coin-ring fill-none"
            stroke={mark}
            transform="rotate(-90 60 60)"
            cx="60"
            cy="60"
            r="50"
            strokeWidth="3"
          />
        )}
        {/* A soft dark copy just below-right makes the gold Rs look struck
            into the coin; hidden on a theme coin (index.css). */}
        {!small && <path className="brand-coin-emboss" d={RS_PATH} transform="translate(0.9 1.1)" />}
        <path fill={mark} d={small ? RS_SMALL_PATH : RS_PATH} />
        {!small && (
          <>
            <path
              className="brand-coin-flourish fill-none"
              stroke={mark}
              d={FLOURISH_PATH}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <g clipPath={`url(#${uid}-clip)`}>
              <g transform="rotate(22 60 60)">
                <rect className="brand-coin-shine" x="-10" y="-30" width="34" height="180" fill={`url(#${uid}-shine)`} />
              </g>
            </g>
          </>
        )}
      </svg>
    </span>
  )
}

export function BrandHeader({ tagline = false }: BrandHeaderProps) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size="md" className="h-10 w-10" />
      <div className="flex flex-col gap-0">
        <span className="font-serif text-xl font-semibold leading-tight text-slate-900">
          Ledge<span className="text-accent-dark">Eaze</span>
        </span>
        {tagline && (
          <p className="text-[11px] font-medium uppercase leading-tight tracking-wider text-slate-400">
            Effortless money management
          </p>
        )}
      </div>
    </div>
  )
}
