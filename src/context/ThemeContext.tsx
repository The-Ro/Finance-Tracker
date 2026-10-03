import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useUserSettings } from '@/hooks/useUserSettings'
import { ACCENT_HEX } from '@/lib/themeColors'
import { deriveAccentShades } from '@/lib/colorUtils'
import type { ThemeAccent, ThemeMode } from '@/types/database.types'

interface ThemeContextValue {
  mode: ThemeMode
  accent: ThemeAccent
  /** The currently-effective accent as a concrete hex string -- resolves a
   *  preset's fixed color, or the user's custom pick when accent is 'custom'.
   *  Charts use this directly instead of re-deriving it from `accent`. */
  accentHex: string
  isDark: boolean
  setMode: (mode: ThemeMode) => void
  setAccent: (accent: ThemeAccent) => void
  /** Picks an arbitrary color and switches accent to 'custom' in one step. */
  setCustomColor: (hex: string) => void
  /** The coin mark follows the accent (true) or stays gold (false, the default). */
  coinFollowsTheme: boolean
  setCoinFollowsTheme: (follow: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function computeIsDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

function resolveAccentHex(accent: ThemeAccent, customColor: string | null): string {
  if (accent === 'custom' && customColor) return customColor
  return ACCENT_HEX[accent] ?? ACCENT_HEX.oxblood
}

/**
 * Preset accents get their --accent/-light/-dark CSS variables from
 * [data-accent='x'] rules in index.css -- fixed at build time. A custom
 * color has no such rule, so it's applied as inline styles on <html>
 * instead (which win over the class-based rules), computed fresh whenever
 * the color or light/dark mode changes. Inline properties are cleared for
 * preset accents so the CSS rules take back over normally.
 */
/** --app-card in light and dark (index.css), for the iPhone status bar strip. */
const STATUS_BAR_LIGHT = '#ffffff'
const STATUS_BAR_DARK = '#1e2129'

function applyToDocument(mode: ThemeMode, accent: ThemeAccent, customColor: string | null, coinFollowsTheme: boolean) {
  const isDark = computeIsDark(mode)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.setAttribute('data-accent', accent)
  // --coin: gold by default, or the accent (index.css :root[data-coin='theme']).
  document.documentElement.setAttribute('data-coin', coinFollowsTheme ? 'theme' : 'gold')
  // The iPhone status bar strip (status-bar-style "default") takes this colour:
  // the header's own (--app-card), so the top reads as one solid bar.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? STATUS_BAR_DARK : STATUS_BAR_LIGHT)

  const root = document.documentElement.style
  let customShades: string | null = null
  if (accent === 'custom' && customColor) {
    const shades = deriveAccentShades(customColor, isDark)
    root.setProperty('--accent', shades.accent)
    root.setProperty('--accent-light', shades.accentLight)
    root.setProperty('--accent-dark', shades.accentDark)
    customShades = JSON.stringify([shades.accent, shades.accentLight, shades.accentDark])
  } else {
    root.removeProperty('--accent')
    root.removeProperty('--accent-light')
    root.removeProperty('--accent-dark')
  }

  try {
    localStorage.setItem('ledgerly-theme-mode', mode)
    localStorage.setItem('ledgerly-theme-accent', accent)
    localStorage.setItem('ledgerly-coin', coinFollowsTheme ? 'theme' : 'gold')
    // A custom colour's shades, so index.html can paint them before React mounts.
    if (customShades) localStorage.setItem('ledgerly-theme-custom', customShades)
    else localStorage.removeItem('ledgerly-theme-custom')
  } catch {
    // Private browsing / storage blocked -- theme still applies for this load.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: settings, updateTheme } = useUserSettings()
  const mode = settings?.themeMode ?? 'system'
  const accent = settings?.themeAccent ?? 'oxblood'
  const customColor = settings?.themeCustomColor ?? null
  const coin = settings?.coinFollowsTheme ?? false
  // Start from what index.html's pre-mount script applied (the last-known theme).
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const loaded = !!settings

  // Re-apply whenever the saved preference changes (e.g. loaded from server, or changed on another device).
  // Only once the settings are here: before that (loading, or signed out on the
  // sign-in page) the defaults above would paint Oxblood + a gold coin over the
  // user's own theme and save them as the last-known theme, so the next sign-in
  // flashed the defaults before switching to e.g. Plum.
  useEffect(() => {
    if (!loaded) return
    applyToDocument(mode, accent, customColor, coin)
    setIsDark(computeIsDark(mode))
  }, [loaded, mode, accent, customColor, coin])

  // Live-update when the OS theme changes while in "system" mode.
  useEffect(() => {
    if (!loaded || mode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      applyToDocument(mode, accent, customColor, coin)
      setIsDark(computeIsDark(mode))
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [loaded, mode, accent, customColor, coin])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      accent,
      accentHex: resolveAccentHex(accent, customColor),
      isDark,
      setMode: (newMode) => {
        applyToDocument(newMode, accent, customColor, coin)
        setIsDark(computeIsDark(newMode))
        updateTheme.mutate({ themeMode: newMode })
      },
      setAccent: (newAccent) => {
        applyToDocument(mode, newAccent, customColor, coin)
        updateTheme.mutate({ themeAccent: newAccent })
      },
      setCustomColor: (hex) => {
        applyToDocument(mode, 'custom', hex, coin)
        updateTheme.mutate({ themeAccent: 'custom', themeCustomColor: hex })
      },
      coinFollowsTheme: coin,
      setCoinFollowsTheme: (follow) => {
        applyToDocument(mode, accent, customColor, follow)
        updateTheme.mutate({ coinFollowsTheme: follow })
      },
    }),
    [mode, accent, customColor, coin, isDark, updateTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
