const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/

export function isValidHexColor(value: string): boolean {
  return HEX_PATTERN.test(value)
}

function mix(channel: number, target: number, t: number): number {
  return Math.round(channel + (target - channel) * t)
}

interface AccentShades {
  accent: string
  accentLight: string
  accentDark: string
}

/**
 * Derives the same three CSS-variable triplets (`--accent`/`-light`/`-dark`)
 * the preset accents each have hand-picked in index.css, from an arbitrary
 * user-chosen hex color -- so a custom color gets pale-tint and darkened
 * variants automatically instead of needing them picked by hand. Mix ratios
 * were reverse-engineered from the preset accents' own light/dark values
 * (e.g. violet's accent-light sits ~90% of the way to white; its dark-mode
 * tint sits ~75% of the way to near-black).
 */
export function deriveAccentShades(hex: string, isDark: boolean): AccentShades {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const accent = `${r} ${g} ${b}`
  const accentDark = `${mix(r, 0, 0.22)} ${mix(g, 0, 0.22)} ${mix(b, 0, 0.22)}`
  const accentLight = isDark
    ? `${mix(r, 20, 0.75)} ${mix(g, 20, 0.75)} ${mix(b, 20, 0.75)}`
    : `${mix(r, 255, 0.9)} ${mix(g, 255, 0.9)} ${mix(b, 255, 0.9)}`

  return { accent, accentLight, accentDark }
}
