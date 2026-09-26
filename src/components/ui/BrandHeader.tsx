interface BrandHeaderProps {
  /** Shows the "Effortless money management" tagline underneath the
   *  wordmark -- only the auth pages (a first impression, plenty of room)
   *  use this; compact in-app spots (the floating nav pill) don't. */
  tagline?: boolean
}

// Glyph outlines of "Rs" in Fraunces Bold Italic, pre-converted to paths so
// the mark never depends on a font being loaded. Regenerate (and the PWA
// icons) with the opentype.js script described in CLAUDE.md's branding section.
const RS_PATH = 'M53.98 57.02L56.20 64.58Q56.50 65.60 56.88 66.28Q57.25 66.95 57.71 67.27Q58.18 67.58 58.75 67.58Q59.38 67.58 59.95 67.22Q60.52 66.86 61.12 66.23Q61.39 65.99 61.81 65.87Q62.23 65.75 62.56 65.90Q63.19 66.11 63.35 66.71Q63.52 67.31 63.16 68.15Q61.84 71.27 59.05 73.06Q56.26 74.84 52.84 74.84Q51.22 74.84 50.03 74.33Q48.85 73.82 48.04 72.67Q47.23 71.51 46.72 69.65L43.84 58.43Q41.14 58.40 39.19 57.89Q38.77 59.48 38.38 60.95Q37.75 63.38 37.30 65.22Q36.85 67.07 36.67 67.97Q36.40 69.02 36.67 69.39Q36.94 69.77 37.48 70.01L38.83 70.43Q39.43 70.73 39.79 71.14Q40.15 71.54 40.15 72.14Q40.15 72.98 39.56 73.49Q38.98 74 37.81 74L23.05 74Q21.91 74 21.49 73.53Q21.07 73.07 21.07 72.38Q21.07 71.63 21.53 71.17Q22 70.70 22.63 70.46L24.10 70.10Q24.82 69.89 25.21 69.42Q25.60 68.96 25.90 68.06Q26.11 67.34 26.59 65.56Q27.07 63.77 27.71 61.34Q28.36 58.91 29.11 56.12Q29.86 53.33 30.59 50.54Q31.33 47.75 31.96 45.29Q32.59 42.83 33.04 41.03Q33.49 39.23 33.64 38.45Q33.94 37.22 33.89 36.68Q33.85 36.14 32.98 35.81L31.57 35.45Q30.97 35.18 30.65 34.80Q30.34 34.43 30.34 33.89Q30.34 33.05 30.95 32.52Q31.57 32 32.68 32L49.87 32Q55.33 32 59.03 33.71Q62.74 35.42 64.34 38.55Q65.95 41.69 65.02 46.01Q64.27 49.73 61.57 52.51Q58.87 55.28 54.61 56.81Q54.31 56.93 53.98 57.02M41.17 50.36L40 54.80Q40.27 54.86 40.57 54.92Q42.13 55.31 44.02 55.31Q46.90 55.31 49.05 54Q51.19 52.70 52.57 50.28Q53.95 47.87 54.46 44.60Q54.97 41.36 54.29 39.30Q53.62 37.25 52.12 36.25Q50.62 35.24 48.61 35.24Q46.63 35.24 45.74 36.08Q44.86 36.92 44.38 38.42Q44.14 39.26 43.64 41.06Q43.15 42.86 42.52 45.26Q41.89 47.66 41.17 50.36M78.46 71.51Q79.96 71.51 80.84 70.70Q81.73 69.89 81.73 68.60Q81.73 67.70 81.33 66.95Q80.92 66.20 79.83 65.34Q78.73 64.49 76.57 63.26Q74.14 61.88 72.69 60.63Q71.23 59.39 70.57 58Q69.91 56.60 69.91 54.80Q69.91 52.22 71.59 50.06Q73.27 47.90 76.44 46.58Q79.60 45.26 84.19 45.26Q87.76 45.26 90.10 46.14Q92.44 47.03 93.61 48.56Q94.78 50.09 94.78 52.04Q94.81 53.90 94.05 54.91Q93.28 55.91 91.90 55.91Q90.61 55.91 89.68 55.09Q88.75 54.26 87.79 52.16Q86.83 50.30 85.66 49.36Q84.49 48.41 82.96 48.41Q81.46 48.41 80.59 49.19Q79.72 49.97 79.72 51.35Q79.72 52.19 80.13 53.02Q80.53 53.84 81.66 54.83Q82.78 55.82 84.91 57.17Q87.61 58.79 89.06 60.13Q90.52 61.46 91.08 62.80Q91.63 64.13 91.63 65.84Q91.63 68.48 89.89 70.49Q88.15 72.50 85.02 73.66Q81.88 74.81 77.65 74.81Q73.63 74.81 71.09 73.82Q68.56 72.83 67.38 71.19Q66.19 69.56 66.19 67.64Q66.25 65.96 67 64.97Q67.75 63.98 69.10 63.98Q70.63 63.98 71.65 64.94Q72.67 65.90 73.57 67.85Q74.68 69.92 75.85 70.72Q77.02 71.51 78.46 71.51'
const FLOURISH_PATH = 'M26 90C44 84 70 98 96 86'

/** The Signature Rs mark: italic Rs plus a hand-drawn flourish on a card-
 *  colored tile. Letters use accent-dark so the mark follows the accent
 *  theme and light/dark mode. Draws itself in once on mount (index.css
 *  .brand-mark rules, reduced-motion safe). */
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={`brand-mark shrink-0 ${className}`} aria-hidden="true">
      <rect className="brand-mark-tile fill-app-card stroke-app-border" x="1" y="1" width="118" height="118" rx="30" strokeWidth="2" />
      <path className="brand-mark-letters fill-accent-dark" d={RS_PATH} />
      <path className="brand-mark-flourish stroke-accent-dark" d={FLOURISH_PATH} fill="none" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function BrandHeader({ tagline = false }: BrandHeaderProps) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="flex flex-col gap-0">
        <span className="font-serif text-xl font-semibold leading-tight text-slate-900">
          Ledge<span className="text-accent-dark">Eaze</span>
        </span>
        {tagline && (
          <p className="text-[10px] font-medium uppercase leading-tight tracking-wider text-slate-400">
            Effortless money management
          </p>
        )}
      </div>
    </div>
  )
}
