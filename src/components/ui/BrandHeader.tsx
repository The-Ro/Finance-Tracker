interface BrandHeaderProps {
  /** Shows the "Effortless money management" tagline underneath the
   *  wordmark -- only the auth pages (a first impression, plenty of room)
   *  use this; compact in-app spots (the floating nav pill) don't. */
  tagline?: boolean
}

/** The wallet mark. This is the user's exact logo artwork (public/icons/
 *  wallet-mark.png, color-key-extracted from logo/logo.png -- see
 *  CLAUDE.md's "App icon / branding" section), used as a CSS mask rather
 *  than a plain <img> so it still fills with the current accent color and
 *  responds to light/dark mode like the old hand-vectorized SVG did --
 *  pixel-exact shape, same theming behavior. The mask image is transparent
 *  outline-only art (no background square) at its own true aspect ratio
 *  (480x292, ~1.64:1), so the box below matches that instead of forcing a
 *  square like the old viewBox did. */
export function WalletMark() {
  return (
    <div
      className="h-7 w-auto shrink-0 bg-accent-dark"
      style={{
        aspectRatio: '480 / 292',
        WebkitMaskImage: 'url(/icons/wallet-mark.png)',
        maskImage: 'url(/icons/wallet-mark.png)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
      aria-hidden="true"
    />
  )
}

export function BrandHeader({ tagline = false }: BrandHeaderProps) {
  return (
    <div className="flex items-center gap-2.5">
      <WalletMark />
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
