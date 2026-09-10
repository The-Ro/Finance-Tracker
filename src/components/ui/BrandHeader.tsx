interface BrandHeaderProps {
  /** Shows the "Effortless money management" tagline underneath the
   *  wordmark -- only the auth pages (a first impression, plenty of room)
   *  use this; compact in-app spots (the floating nav pill) don't. */
  tagline?: boolean
}

/** The icon here is the real app icon (public/icons/icon-192.png) shown
 *  directly at its own native rounded-square treatment -- not wrapped in a
 *  second colored circle/box the way the old placeholder "L" mark was. */
export function BrandHeader({ tagline = false }: BrandHeaderProps) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/icons/icon-192.png" alt="" className="h-9 w-9 shrink-0 rounded-lg" />
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
