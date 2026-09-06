import clsx from 'clsx'
import { Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useTheme } from '@/context/ThemeContext'
import { ACCENT_HEX } from '@/lib/themeColors'
import type { ThemeAccent, ThemeMode } from '@/types/database.types'

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const ACCENTS: { value: ThemeAccent; label: string; swatch: string }[] = [
  { value: 'violet', label: 'Violet', swatch: ACCENT_HEX.violet },
  { value: 'ocean', label: 'Ocean', swatch: ACCENT_HEX.ocean },
  { value: 'sunset', label: 'Sunset', swatch: ACCENT_HEX.sunset },
  { value: 'pink', label: 'Pink', swatch: ACCENT_HEX.pink },
  { value: 'green', label: 'Green', swatch: ACCENT_HEX.green },
]

export function ThemeSettings() {
  const { mode, accent, setMode, setAccent } = useTheme()

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Appearance</h3>
        <p className="mt-1 text-helper text-slate-500">Choose a light/dark mode and an accent theme.</p>
      </div>

      <div>
        <p className="mb-2 text-helper font-medium text-slate-600">Mode</p>
        <div className="flex rounded-lg border border-app-border p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={clsx(
                'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
                mode === m.value ? 'bg-accent text-white' : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-helper font-medium text-slate-600">Accent theme</p>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAccent(a.value)}
              aria-label={`Use ${a.label} accent theme`}
              className="flex w-14 flex-col items-center gap-1.5"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-105"
                style={{
                  backgroundColor: a.swatch,
                  borderColor: accent === a.value ? a.swatch : 'transparent',
                  outline: accent === a.value ? `2px solid ${a.swatch}` : 'none',
                  outlineOffset: '2px',
                }}
              >
                {accent === a.value && <Check size={16} className="animate-pop-in text-white" />}
              </span>
              <span className="text-helper text-slate-500">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}
