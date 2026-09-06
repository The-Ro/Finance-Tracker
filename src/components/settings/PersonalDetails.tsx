import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useUserSettings } from '@/hooks/useUserSettings'
import type { Gender } from '@/types/database.types'

const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  prefer_not_to_say: 'Prefer not to say',
}
const GENDER_OPTIONS: Gender[] = ['male', 'female', 'prefer_not_to_say']
const UNSET = '(not set)'

export function PersonalDetails() {
  const { data, updatePersonalDetails } = useUserSettings()
  const [gender, setGender] = useState<Gender | null>(null)
  const [dob, setDob] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setGender(data?.gender ?? null)
    setDob(data?.dateOfBirth ?? '')
  }, [data?.gender, data?.dateOfBirth])

  const handleSave = async () => {
    setSaved(false)
    setError(null)
    try {
      await updatePersonalDetails.mutateAsync({ gender, dateOfBirth: dob || null })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const unchanged = gender === (data?.gender ?? null) && dob === (data?.dateOfBirth ?? '')

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
      </div>

      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      {saved && <InlineMessage tone="success">Personal details saved.</InlineMessage>}

      <div>
        <Button onClick={handleSave} disabled={updatePersonalDetails.isPending || unchanged}>
          {updatePersonalDetails.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Card>
  )
}
