import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Plus, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { Dropdown } from '@/components/ui/Dropdown'
import { Pill } from '@/components/ui/Pill'
import { useUserSettings } from '@/hooks/useUserSettings'
import { ZODIAC_SIGNS } from '@/lib/zodiac'
import type { Gender, ZodiacSign } from '@/types/database.types'
import { FormError } from '@/components/ui/FieldError'

const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  prefer_not_to_say: 'Prefer not to say',
}
const GENDER_OPTIONS: Gender[] = ['male', 'female', 'prefer_not_to_say']
const UNSET = '(not set)'

const SUGGESTED_INTERESTS = [
  'Cycling',
  'Reading',
  'Cooking',
  'Travel',
  'Music',
  'Gaming',
  'Fitness',
  'Photography',
  'Movies',
  'Gardening',
  'Hiking',
  'Art',
]

export function PersonalDetails() {
  const { data, updatePersonalDetails } = useUserSettings()
  const [gender, setGender] = useState<Gender | null>(null)
  const [dob, setDob] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [newInterest, setNewInterest] = useState('')
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setGender(data?.gender ?? null)
    setDob(data?.dateOfBirth ?? '')
    setInterests(data?.interests ?? [])
    setZodiacSign(data?.zodiacSign ?? null)
  }, [data?.gender, data?.dateOfBirth, data?.interests, data?.zodiacSign])

  // Every field here is a discrete pick (dropdown, date-picker, a button
  // toggle, an add/remove chip) rather than free text, so there's nothing to
  // debounce -- each change updates local state immediately (so the UI
  // reacts right away, not after a round trip) and saves in the background.
  const save = async (input: Parameters<typeof updatePersonalDetails.mutateAsync>[0]) => {
    setError(null)
    try {
      await updatePersonalDetails.mutateAsync(input)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const addInterest = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || interests.some((i) => i.toLowerCase() === trimmed.toLowerCase())) return
    const next = [...interests, trimmed]
    setInterests(next)
    setNewInterest('')
    save({ interests: next })
  }

  const removeInterest = (interest: string) => {
    const next = interests.filter((i) => i !== interest)
    setInterests(next)
    save({ interests: next })
  }

  const remainingSuggestions = SUGGESTED_INTERESTS.filter(
    (s) => !interests.some((i) => i.toLowerCase() === s.toLowerCase())
  )

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Personal details</h3>
        <p className="mt-1 text-helper text-slate-500">
          Private to you: never shown to other people, even in shared views, unless you turn on the birthday note below. Saved automatically.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-helper font-medium text-slate-600">Gender</label>
          <Dropdown
            options={[UNSET, ...GENDER_OPTIONS.map((g) => GENDER_LABELS[g])]}
            value={gender ? GENDER_LABELS[gender] : UNSET}
            onChange={(e) => {
              const match = GENDER_OPTIONS.find((g) => GENDER_LABELS[g] === e.target.value) ?? null
              setGender(match)
              save({ gender: match })
            }}
          />
        </div>
        <TextField
          label="Date of birth"
          type="date"
          value={dob}
          onChange={(e) => {
            setDob(e.target.value)
            save({ dateOfBirth: e.target.value || null })
          }}
        />
        {dob && (
          <label className="col-span-2 flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-app-border px-3 py-2">
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-slate-800">Tell the people I share with on my birthday</span>
              <span className="text-helper text-slate-500">They get a note to wish you. Only the day, never the year.</span>
            </span>
            <input
              type="checkbox"
              checked={data?.shareBirthday ?? false}
              onChange={(e) => save({ shareBirthday: e.target.checked })}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={clsx(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2',
                data?.shareBirthday ? 'bg-accent' : 'bg-slate-300'
              )}
            >
              <span
                className={clsx(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  data?.shareBirthday ? 'translate-x-[22px]' : 'translate-x-0.5'
                )}
              />
            </span>
          </label>
        )}

        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-helper font-medium text-slate-600">
            <Sparkles size={13} className="text-accent-dark" /> Horoscope
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ZODIAC_SIGNS.map((z) => (
              <button
                key={z.sign}
                type="button"
                onClick={() => {
                  const next = zodiacSign === z.sign ? null : (z.sign as ZodiacSign)
                  setZodiacSign(next)
                  save({ zodiacSign: next })
                }}
                aria-pressed={zodiacSign === z.sign}
                className={clsx(
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 text-helper font-medium',
                  zodiacSign === z.sign
                    ? 'border-accent bg-accent-light text-accent-on-light'
                    : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
                )}
              >
                <span>{z.symbol}</span> {z.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-helper font-medium text-slate-600">Interests</label>
        {interests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <Pill key={interest} label={interest} onRemove={() => removeInterest(interest)} />
            ))}
          </div>
        )}
        {remainingSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {remainingSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addInterest(suggestion)}
                className="rounded-full border border-app-border px-2.5 py-1 text-helper text-slate-600 hover:border-accent hover:text-accent-dark"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addInterest(newInterest)
              }
            }}
            placeholder="e.g. Cycling"
            className="min-h-[44px] flex-1 rounded-lg border border-app-border bg-white px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={() => addInterest(newInterest)}
            aria-label="Add interest"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-app-border text-slate-600 hover:border-accent hover:text-accent-dark"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <FormError message={error} />
    </Card>
  )
}
