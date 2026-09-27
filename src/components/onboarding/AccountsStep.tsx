import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useAuth } from '@/context/AuthContext'
import { useAccounts, useAccountOpeningBalances, useSetAccountOpeningBalance } from '@/hooks/useLookupLists'
import { useAccountBalances } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { matchAccountName, openingBalanceForToday, parseBalance } from '@/lib/onboardingAccounts'

interface AccountsStepProps {
  onBack: () => void
  onDone: () => void
  finishing: boolean
}

const DATALIST_ID = 'onboarding-account-names'

/**
 * Onboarding's "Where does your money live?" step. Lists the accounts that
 * already hold something (or were touched in this step) with their balance
 * today, and lets the user add an account -- or pick one of the seeded ones --
 * and say what's in it today. That figure is stored as the account's opening
 * balance through the set_account_opening_balance RPC, minus whatever logged
 * transactions already contribute, so the balance shown everywhere matches it.
 */
export function AccountsStep({ onBack, onDone, finishing }: AccountsStepProps) {
  const { userId } = useAuth()
  const accounts = useAccounts()
  const { data: openingBalances } = useAccountOpeningBalances()
  const balances = useAccountBalances(userId)
  const setOpening = useSetAccountOpeningBalance()
  const { format } = useFormatCurrency()

  const accountNames = useMemo(() => accounts.data ?? [], [accounts.data])
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [touched, setTouched] = useState<string[]>([])
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const listed = useMemo(
    () =>
      accountNames
        .filter((n) => (balances.get(n) ?? 0) !== 0 || touched.includes(n))
        .map((n) => ({ name: n, balance: balances.get(n) ?? 0 })),
    [accountNames, balances, touched]
  )

  const existingMatch = matchAccountName(name, accountNames)

  /** Saves the form. Resolves true on success (or nothing to save). */
  const save = async (): Promise<boolean> => {
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the account a name.')
      return false
    }
    const value = parseBalance(balance)
    if (value === null) {
      setError('Enter a valid balance. Use a minus sign for a card you owe on.')
      return false
    }
    const target = existingMatch ?? trimmed
    setSaving(true)
    try {
      if (!existingMatch) await accounts.add.mutateAsync(trimmed)
      const currentOpening = openingBalances?.get(target) ?? 0
      const opening = openingBalanceForToday(value, balances.get(target) ?? 0, currentOpening)
      if (opening !== currentOpening) await setOpening.mutateAsync({ account: target, amount: opening })
      setTouched((t) => (t.includes(target) ? t : [...t, target]))
      setLastSaved(target)
      setName('')
      setBalance('')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this account.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleContinue = async () => {
    // Anything typed but not added yet still counts -- don't silently drop it.
    if (name.trim() || balance.trim()) {
      if (!(await save())) return
    }
    onDone()
  }

  const busy = saving || finishing

  return (
    <div className="flex flex-col gap-4">
      <div className="animate-fade-in-up flex flex-col gap-1.5">
        <h3 className="font-serif text-2xl font-semibold leading-tight text-slate-900">Where does your money live?</h3>
        <p className="text-sm text-slate-600">
          Add each account with what's in it today, so balances start out right. Use a negative number for a card
          you owe on.
        </p>
      </div>

      {listed.length > 0 && (
        <ul className="stagger-rows flex flex-col gap-2" aria-label="Your accounts">
          {listed.map((a) => (
            <li key={a.name}>
              <button
                type="button"
                onClick={() => {
                  setName(a.name)
                  setBalance(String(a.balance))
                  setError(null)
                }}
                aria-label={`Change ${a.name}, balance today ${format(a.balance)}`}
                className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-app-border px-3 py-2 text-left transition-colors hover:bg-slate-50"
              >
                <span
                  className={clsx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-positive-light text-positive',
                    lastSaved === a.name && 'animate-pop-in'
                  )}
                  aria-hidden="true"
                >
                  <Check size={18} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{a.name}</span>
                <span
                  className={clsx(
                    'shrink-0 font-serif text-base font-semibold tabular-nums',
                    a.balance < 0 ? 'text-danger' : 'text-slate-900'
                  )}
                >
                  {format(a.balance)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-3 rounded-xl border border-app-border p-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <TextField
          label="Account name"
          id="onboarding-account-name"
          list={DATALIST_ID}
          autoComplete="off"
          placeholder="e.g. HDFC Bank, Cash, Axis Card"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <datalist id={DATALIST_ID}>
          {accountNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <TextField
          label="Balance today"
          id="onboarding-account-balance"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          {saving ? 'Saving…' : existingMatch ? `Update ${existingMatch}` : 'Add account'}
        </Button>
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
      </form>

      <p className="text-center text-helper text-slate-500">
        You can change these later in Settings → Financial setup → Starting balances.
      </p>

      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={busy}>
          {finishing ? 'Finishing…' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
