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
function applyToDocument(mode: ThemeMode, accent: ThemeAccent, customColor: string | null) {
  const isDark = computeIsDark(mode)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.setAttribute('data-accent', accent)

  const root = document.documentElement.style
  if (accent === 'custom' && customColor) {
    const shades = deriveAccentShades(customColor, isDark)
    root.setProperty('--accent', shades.accent)
    root.setProperty('--accent-light', shades.accentLight)
    root.setProperty('--accent-dark', shades.accentDark)
  } else {
    root.removeProperty('--accent')
    root.removeProperty('--accent-light')
    root.removeProperty('--accent-dark')
  }

  try {
    localStorage.setItem('ledgerly-theme-mode', mode)
    localStorage.setItem('ledgerly-theme-accent', accent)
  } catch {
    // Private browsing / storage blocked -- theme still applies for this load.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: settings, updateTheme } = useUserSettings()
  const mode = settings?.themeMode ?? 'system'
  const accent = settings?.themeAccent ?? 'oxblood'
  const customColor = settings?.themeCustomColor ?? null
  const [isDark, setIsDark] = useState(() => computeIsDark(mode))

  // Re-apply whenever the saved preference changes (e.g. loaded from server, or changed on another device).
  useEffect(() => {
    applyToDocument(mode, accent, customColor)
    setIsDark(computeIsDark(mode))
  }, [mode, accent, customColor])

  // Live-update when the OS theme changes while in "system" mode.
  useEffect(() => {
    if (mode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      applyToDocument(mode, accent, customColor)
      setIsDark(computeIsDark(mode))
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [mode, accent, customColor])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      accent,
      accentHex: resolveAccentHex(accent, customColor),
      isDark,
      setMode: (newMode) => {
        applyToDocument(newMode, accent, customColor)
        setIsDark(computeIsDark(newMode))
        updateTheme.mutate({ themeMode: newMode })
      },
      setAccent: (newAccent) => {
        applyToDocument(mode, newAccent, customColor)
        updateTheme.mutate({ themeAccent: newAccent })
      },
      setCustomColor: (hex) => {
        applyToDocument(mode, 'custom', hex)
        updateTheme.mutate({ themeAccent: 'custom', themeCustomColor: hex })
      },
    }),
    [mode, accent, customColor, isDark, updateTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
