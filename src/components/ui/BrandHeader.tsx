interface BrandHeaderProps {
  /** Shows the "Effortless money management" tagline underneath the
   *  wordmark -- only the auth pages (a first impression, plenty of room)
   *  use this; compact in-app spots (the floating nav pill) don't. */
  tagline?: boolean
}

/** Just the card + "Rs" glyph from the app icon -- no background square
 *  behind it here. (The app icon file itself still has its own filled
 *  background baked in, for favicon/home-screen use where a transparent
 *  icon wouldn't work; this is a separate transparent outline version of
 *  the same artwork, colored via currentColor, for sitting directly on a
 *  page instead.) */
function WalletMark() {
  return (
    <svg viewBox="0 0 220 150" className="h-9 w-9 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="13">
      <rect x="6.5" y="6.5" width="207" height="137" rx="16" />
      <line x1="6.5" y1="56.5" x2="213.5" y2="56.5" />
      <rect x="138.5" y="106.5" width="63.5" height="33.5" rx="6" strokeWidth="5" />
      <text x="170" y="130" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontSize="21" fill="currentColor" stroke="none" textAnchor="middle">
        Rs
      </text>
    </svg>
  )
}

export function BrandHeader({ tagline = false }: BrandHeaderProps) {
  return (
    <div className="flex items-center gap-2.5">
      <WalletMark />
      <div className="flex flex-col gap-0">
        <span className="font-serif text-xl font-semibold leading-tight text-slate-900">
          Ledge<span className="text-accent">Eaze</span>
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
