import { useEffect, useState } from 'react'
import { Download, Share } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Dropdown } from '@/components/ui/Dropdown'
import { useAuth } from '@/context/AuthContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useUpdateProfile } from '@/hooks/useUpdateProfile'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from '@/lib/currency'

const currencyOptions = SUPPORTED_CURRENCIES.map((c) => `${c.code} - ${c.label} (${c.symbol})`)
const labelForCode = (code: string) => currencyOptions.find((o) => o.startsWith(code + ' ')) ?? currencyOptions[0]

export function WelcomeModal() {
  const { displayName, refreshProfile } = useAuth()
  const settings = useUserSettings()
  const updateProfile = useUpdateProfile()
  const { isStandalone, isIos, canPromptInstall, promptInstall } = usePwaInstall()

  const [name, setName] = useState('')
  const [currencyLabel, setCurrencyLabel] = useState(labelForCode(DEFAULT_CURRENCY))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings.data) return
    setName(displayName)
    setCurrencyLabel(labelForCode(settings.data.currency))
    // Only seed the form once, when settings first arrive -- not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!settings.data])

  const show = !settings.isLoading && !!settings.data && !settings.data.onboardingCompleted
  if (!show) return null

  const finish = async (saveChanges: boolean) => {
    setSaving(true)
    try {
      if (saveChanges) {
        const trimmed = name.trim()
        if (trimmed && trimmed !== displayName) {
          await updateProfile.mutateAsync({ displayName: trimmed })
          refreshProfile()
        }
        const code = currencyLabel.split(' ')[0]
        if (code !== settings.data?.currency) {
          await settings.updateCurrency.mutateAsync(code)
        }
      }
      await settings.completeOnboarding.mutateAsync()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Welcome to LedgeEaze" onClose={() => finish(false)}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          LedgeEaze is a shared finance tracker: everyone you connect with can see each other's transactions once
          you approve access to each other, while your budgets, goals, and personal details stay private to you.
          Let's set up the basics.
        </p>

        <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" />

        <div className="flex flex-col gap-1.5">
          <label className="text-helper font-medium text-slate-600">Currency</label>
          <Dropdown options={currencyOptions} value={currencyLabel} onChange={(e) => setCurrencyLabel(e.target.value)} />
        </div>

        {!isStandalone && (canPromptInstall || isIos) && (
          <div className="rounded-lg border border-app-border bg-slate-50 p-3">
            <p className="mb-2 text-helper font-medium text-slate-600">Install LedgeEaze on this device</p>
            {canPromptInstall ? (
              <Button variant="secondary" onClick={promptInstall} className="w-full">
                <Download size={15} /> Add to Home Screen
              </Button>
            ) : (
              <p className="flex items-center gap-1.5 text-helper text-slate-500">
                Tap <Share size={13} className="inline" /> Share, then "Add to Home Screen".
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={() => finish(false)} disabled={saving}>
            Skip for now
          </Button>
          <Button onClick={() => finish(true)} disabled={saving}>
            {saving ? 'Saving…' : 'Get started'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
