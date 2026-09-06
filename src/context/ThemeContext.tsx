import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useUserSettings } from '@/hooks/useUserSettings'
import type { ThemeAccent, ThemeMode } from '@/types/database.types'

interface ThemeContextValue {
  mode: ThemeMode
  accent: ThemeAccent
  isDark: boolean
  setMode: (mode: ThemeMode) => void
  setAccent: (accent: ThemeAccent) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function computeIsDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

function applyToDocument(mode: ThemeMode, accent: ThemeAccent) {
  document.documentElement.classList.toggle('dark', computeIsDark(mode))
  document.documentElement.setAttribute('data-accent', accent)
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
  const accent = settings?.themeAccent ?? 'violet'
  const [isDark, setIsDark] = useState(() => computeIsDark(mode))

  // Re-apply whenever the saved preference changes (e.g. loaded from server, or changed on another device).
  useEffect(() => {
    applyToDocument(mode, accent)
    setIsDark(computeIsDark(mode))
  }, [mode, accent])

  // Live-update when the OS theme changes while in "system" mode.
  useEffect(() => {
    if (mode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      applyToDocument(mode, accent)
      setIsDark(computeIsDark(mode))
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [mode, accent])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      accent,
      isDark,
      setMode: (newMode) => {
        applyToDocument(newMode, accent)
        setIsDark(computeIsDark(newMode))
        updateTheme.mutate({ themeMode: newMode })
      },
      setAccent: (newAccent) => {
        applyToDocument(mode, newAccent)
        updateTheme.mutate({ themeAccent: newAccent })
      },
    }),
    [mode, accent, isDark, updateTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
