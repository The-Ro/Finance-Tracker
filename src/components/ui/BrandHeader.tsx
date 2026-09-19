interface BrandHeaderProps {
  /** Shows the "Effortless money management" tagline underneath the
   *  wordmark -- only the auth pages (a first impression, plenty of room)
   *  use this; compact in-app spots (the floating nav pill) don't. */
  tagline?: boolean
}

/** The wallet mark, transparent and outline-only -- no background square
 *  behind it here. (The app icon file itself still has its own filled
 *  background baked in, for favicon/home-screen use where a transparent
 *  icon wouldn't work; this is a separate transparent outline version of
 *  the same artwork, colored via currentColor, for sitting directly on a
 *  page instead.) A card sits tucked inside behind the fold -- its path has
 *  no closing bottom edge, which is what sells "behind" rather than "on
 *  top of." */
function WalletMark() {
  return (
    <svg viewBox="0 0 220 170" className="h-9 w-9 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Card tucked inside the wallet -- open bottom, no closing segment, so
          it reads as sitting behind the fold rather than floating on top. */}
      <path d="M42,68 L42,20 Q42,6 56,6 L164,6 Q178,6 178,20 L178,68" />
      <text x="54" y="38" fontFamily="'Segoe UI', system-ui, sans-serif" fontWeight="600" fontSize="15" letterSpacing="1.5" fill="currentColor" stroke="none">
        ROSA
      </text>
      <text x="166" y="38" fontFamily="'Segoe UI', system-ui, sans-serif" fontWeight="600" fontSize="17" fill="currentColor" stroke="none" textAnchor="end">
        ₹246.26
      </text>
      {/* Wallet body */}
      <rect x="10" y="50" width="200" height="114" rx="18" />
      {/* Fold, a single soft curve rather than a straight crease */}
      <path d="M10,72 C70,50 130,100 210,66" />
      {/* Free-standing signature -- never boxed */}
      <text x="190" y="148" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontSize="44" fill="currentColor" stroke="none" textAnchor="end">
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
