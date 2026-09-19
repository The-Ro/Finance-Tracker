import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Check, Palette } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useTheme } from '@/context/ThemeContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import { ACCENT_HEX } from '@/lib/themeColors'
import { isValidHexColor } from '@/lib/colorUtils'
import type { ThemeAccent, ThemeMode } from '@/types/database.types'

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const ACCENTS: { value: ThemeAccent; label: string; swatch: string }[] = [
  { value: 'oxblood', label: 'Oxblood', swatch: ACCENT_HEX.oxblood },
  { value: 'violet', label: 'Violet', swatch: ACCENT_HEX.violet },
  { value: 'ocean', label: 'Ocean', swatch: ACCENT_HEX.ocean },
  { value: 'sunset', label: 'Sunset', swatch: ACCENT_HEX.sunset },
  { value: 'sage', label: 'Sage', swatch: ACCENT_HEX.sage },
  { value: 'mauve', label: 'Mauve', swatch: ACCENT_HEX.mauve },
  { value: 'plum', label: 'Plum', swatch: ACCENT_HEX.plum },
  { value: 'crimson', label: 'Crimson', swatch: ACCENT_HEX.crimson },
  { value: 'charcoal', label: 'Charcoal', swatch: ACCENT_HEX.charcoal },
]

export function ThemeSettings() {
  const { mode, accent, setMode, setAccent, setCustomColor } = useTheme()
  const { data } = useUserSettings()
  const customColor = data?.themeCustomColor ?? null
  const isCustom = accent === 'custom'

  // Bare 6-digit hex digits, no "#" -- easier to type/paste ("CCFBFA") than
  // requiring the leading hash. Kept as separate typed-input state so a
  // partial/invalid in-progress edit doesn't get clobbered by the synced
  // value on every keystroke; only re-synced when the saved color changes
  // from elsewhere (e.g. picking it via the native swatch below).
  const [hexInput, setHexInput] = useState(() => (customColor ? customColor.slice(1) : ''))
  const [hexError, setHexError] = useState<string | null>(null)

  useEffect(() => {
    setHexInput(customColor ? customColor.slice(1) : '')
  }, [customColor])

  const applyHexInput = () => {
    if (!hexInput) return
    if (hexInput.length !== 6) return setHexError('Enter 6 hex digits, e.g. CCFBFA.')
    const hex = `#${hexInput.toUpperCase()}`
    if (!isValidHexColor(hex)) return setHexError('Not a valid hex color.')
    setHexError(null)
    setCustomColor(hex)
  }

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

          <div className="flex w-14 flex-col items-center gap-1.5">
            <label
              aria-label="Pick a custom accent color"
              className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 transition-transform hover:scale-105"
              style={{
                backgroundColor: isCustom && customColor ? customColor : undefined,
                borderColor: isCustom && customColor ? customColor : 'transparent',
                outline: isCustom && customColor ? `2px solid ${customColor}` : '1px dashed #94a3b8',
                outlineOffset: '2px',
              }}
            >
              {isCustom && customColor ? (
                <Check size={16} className="animate-pop-in text-white" />
              ) : (
                <Palette size={16} className="text-slate-400" />
              )}
              <input
                type="color"
                value={isValidHexColor(customColor ?? '') ? customColor! : '#6558D3'}
                onChange={(e) => setCustomColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <span className="text-helper text-slate-500">Custom</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="flex min-h-[36px] items-center rounded-l-lg border border-r-0 border-app-border bg-slate-50 px-2.5 text-sm text-slate-400">
            #
          </span>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => {
              setHexError(null)
              setHexInput(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))
            }}
            onKeyDown={(e) => e.key === 'Enter' && applyHexInput()}
            onBlur={applyHexInput}
            placeholder="CCFBFA"
            maxLength={6}
            className="min-h-[36px] w-28 rounded-r-lg border border-app-border bg-white px-2.5 text-sm uppercase tracking-wide focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <span className="text-helper text-slate-400">Or type a hex code directly</span>
        </div>
        {hexError && <p className="mt-1 text-helper text-red-600">{hexError}</p>}
      </div>
    </Card>
  )
}
