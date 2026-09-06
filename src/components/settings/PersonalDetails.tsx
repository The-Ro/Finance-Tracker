import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Plus, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { Pill } from '@/components/ui/Pill'
import { useToast } from '@/context/ToastContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import { ZODIAC_SIGNS } from '@/lib/zodiac'
import type { Gender, ZodiacSign } from '@/types/database.types'

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
  const { show } = useToast()
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

  const addInterest = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || interests.some((i) => i.toLowerCase() === trimmed.toLowerCase())) return
    setInterests([...interests, trimmed])
    setNewInterest('')
  }

  const handleSave = async () => {
    setError(null)
    try {
      await updatePersonalDetails.mutateAsync({ gender, dateOfBirth: dob || null, interests, zodiacSign })
      show('Personal details saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const unchanged =
    gender === (data?.gender ?? null) &&
    dob === (data?.dateOfBirth ?? '') &&
    zodiacSign === (data?.zodiacSign ?? null) &&
    JSON.stringify(interests) === JSON.stringify(data?.interests ?? [])

  const remainingSuggestions = SUGGESTED_INTERESTS.filter(
    (s) => !interests.some((i) => i.toLowerCase() === s.toLowerCase())
  )

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Personal details</h3>
        <p className="mt-1 text-helper text-slate-500">
          Private to you - never shown to other users, even in shared views.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-helper font-medium text-slate-600">Gender</label>
          <Dropdown
            options={[UNSET, ...GENDER_OPTIONS.map((g) => GENDER_LABELS[g])]}
            value={gender ? GENDER_LABELS[gender] : UNSET}
            onChange={(e) => {
              const match = GENDER_OPTIONS.find((g) => GENDER_LABELS[g] === e.target.value)
              setGender(match ?? null)
            }}
          />
        </div>
        <TextField label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />

        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-helper font-medium text-slate-600">
            <Sparkles size={13} className="text-accent" /> Horoscope
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ZODIAC_SIGNS.map((z) => (
              <button
                key={z.sign}
                type="button"
                onClick={() => setZodiacSign(zodiacSign === z.sign ? null : z.sign)}
                aria-pressed={zodiacSign === z.sign}
                className={clsx(
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 text-helper font-medium',
                  zodiacSign === z.sign
                    ? 'border-accent bg-accent-light text-accent-dark'
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
              <Pill key={interest} label={interest} onRemove={() => setInterests(interests.filter((i) => i !== interest))} />
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

      {error && <InlineMessage tone="error">{error}</InlineMessage>}

      <div>
        <Button onClick={handleSave} disabled={updatePersonalDetails.isPending || unchanged}>
          {updatePersonalDetails.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Card>
  )
}
