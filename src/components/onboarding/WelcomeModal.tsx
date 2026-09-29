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
import { InlineMessage } from '@/components/ui/InlineMessage'
import { AccountsStep } from './AccountsStep'
import { BanksStep } from './BanksStep'

const currencyOptions = SUPPORTED_CURRENCIES.map((c) => `${c.code} - ${c.label} (${c.symbol})`)
const labelForCode = (code: string) => currencyOptions.find((o) => o.startsWith(code + ' ')) ?? currencyOptions[0]

// You -> your banks -> cards & wallets. Everything else (bills, a budget, a
// goal, import, sharing) is the "Finish setting up" checklist on Home.
const TOTAL_STEPS = 3

function StepProgress({ step, onSkip, disabled }: { step: number; onSkip: () => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-helper text-slate-500">
        <span>
          Step {step} of {TOTAL_STEPS}
        </span>
        <button
          type="button"
          onClick={onSkip}
          disabled={disabled}
          className="-mr-2 min-h-[44px] rounded-lg px-2 font-semibold text-accent-dark hover:underline disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  )
}

export function WelcomeModal() {
  const { displayName, refreshProfile } = useAuth()
  const settings = useUserSettings()
  const updateProfile = useUpdateProfile()
  const { isStandalone, isIos, canPromptInstall, promptInstall } = usePwaInstall()

  const [name, setName] = useState('')
  const [currencyLabel, setCurrencyLabel] = useState(labelForCode(DEFAULT_CURRENCY))
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!settings.data) return
    setName(displayName)
    setCurrencyLabel(labelForCode(settings.data.currency))
    // Only seed the form once, when settings first arrive -- not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!settings.data])

  const show = !settings.isLoading && !!settings.data && !settings.data.onboardingCompleted
  if (!show) return null

  // Step 1's name/currency are saved when moving on to step 2 (so the accounts
  // step already formats money in the chosen currency); "Skip for now" on
  // step 1 keeps the old behavior of saving nothing.
  const saveBasics = async () => {
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

  const finish = async () => {
    setSaving(true)
    setError(null)
    try {
      await settings.completeOnboarding.mutateAsync()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish setup.')
    } finally {
      setSaving(false)
    }
  }

  const continueToAccounts = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveBasics()
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your details.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Welcome to LedgeEaze" onClose={finish}>
      <div className="flex flex-col gap-4">
        <StepProgress step={step} onSkip={finish} disabled={saving} />

        {step === 3 ? (
          <AccountsStep
            onBack={() => setStep(2)}
            onDone={finish}
            finishing={saving}
            title="Cards and wallets"
            description="Add your credit cards with what you owe today, and wallets like Paytm. Your banks are listed too; tap one to change it."
          />
        ) : step === 2 ? (
          <BanksStep onBack={() => setStep(1)} onDone={() => setStep(3)} />
        ) : (
          <>
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
              <Button onClick={continueToAccounts} disabled={saving}>
                {saving ? 'Saving…' : 'Continue'}
              </Button>
            </div>
          </>
        )}

        {error && <InlineMessage tone="error">{error}</InlineMessage>}
      </div>
    </Modal>
  )
}
