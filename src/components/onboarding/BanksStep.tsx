import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Check, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useAuth } from '@/context/AuthContext'
import {
  useAccountCreatedBy,
  useAccountOpeningBalances,
  useAccounts,
  useAddAccount,
  useRemoveAccounts,
  useSetAccountDetails,
  useSetAccountOpeningBalance,
} from '@/hooks/useLookupLists'
import { useAccountBalances } from '@/hooks/useTransactions'
import { useAccountKinds } from '@/hooks/useCards'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { isBankKind } from '@/lib/creditCards'
import { planBankSetup, type BankChoice } from '@/lib/bankSetup'
import { matchAccountName, openingBalanceForToday, parseBalance } from '@/lib/onboardingAccounts'

interface BanksStepProps {
  onBack: () => void
  onDone: () => void
}

interface Draft {
  kind: 'savings' | 'current'
  /** The "Balance today" field as typed; empty = leave the balance alone. */
  balance: string
}

/**
 * Onboarding step 2, "Which banks do you use?": pick your banks from the list
 * seeded at signup (or type one that's missing), say savings or current and
 * what's in each today. On Continue the untouched banks you didn't pick are
 * removed (see planBankSetup -- a bank with any entries is never removed).
 */
export function BanksStep({ onBack, onDone }: BanksStepProps) {
  const { userId } = useAuth()
  const { data: accounts = [], remove: removeOne } = useAccounts()
  const { data: createdBy } = useAccountCreatedBy()
  const { data: openings } = useAccountOpeningBalances()
  const balances = useAccountBalances(userId)
  const kinds = useAccountKinds()
  const { inUse, ready } = useAccountsInUse()
  const addAccount = useAddAccount()
  const removeMany = useRemoveAccounts()
  const setDetails = useSetAccountDetails()
  const setOpening = useSetAccountOpeningBalance()

  const banks = useMemo(() => accounts.filter((n) => isBankKind(kinds.get(n))), [accounts, kinds])
  const [chosen, setChosen] = useState<Map<string, Draft>>(new Map())
  const [seeded, setSeeded] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Start with the banks already in use ticked (once, when everything has loaded).
  useEffect(() => {
    if (seeded || !ready) return
    setChosen(
      new Map(banks.filter((b) => inUse.has(b)).map((b) => [b, { kind: kinds.get(b) === 'current' ? 'current' : 'savings', balance: '' }]))
    )
    setSeeded(true)
  }, [seeded, ready, banks, inUse, kinds])

  const q = query.trim().toLowerCase()
  const available = banks.filter((b) => !chosen.has(b) && (!q || b.toLowerCase().includes(q)))
  const typedIsNew = q.length > 1 && !matchAccountName(query, accounts)

  const choose = (name: string) =>
    setChosen((m) => new Map(m).set(name, { kind: kinds.get(name) === 'current' ? 'current' : 'savings', balance: '' }))
  const unchoose = (name: string) =>
    setChosen((m) => {
      const next = new Map(m)
      next.delete(name)
      return next
    })
  const patch = (name: string, change: Partial<Draft>) =>
    setChosen((m) => new Map(m).set(name, { ...m.get(name)!, ...change }))

  const addTyped = () => {
    const name = query.trim().replace(/\s+/g, ' ')
    if (!name) return
    choose(matchAccountName(name, accounts) ?? name)
    setQuery('')
  }

  const handleContinue = async () => {
    setError(null)
    const choices = new Map<string, BankChoice>()
    for (const [name, draft] of chosen) {
      const parsed = draft.balance.trim() === '' ? null : parseBalance(draft.balance)
      if (draft.balance.trim() !== '' && parsed === null) {
        setError(`Enter the balance for ${name} as a number.`)
        return
      }
      choices.set(name, { kind: draft.kind, balance: parsed })
    }
    const plan = planBankSetup({ accounts, kinds, inUse, createdBy: createdBy ?? new Map(), chosen: choices })
    setSaving(true)
    try {
      await removeMany.mutateAsync(plan.remove)
      const none = { creditLimit: null, statementDay: null, dueDay: null }
      for (const a of plan.adopt) {
        // A seeded bank becomes the user's own (created_by), so it counts as in use from now on.
        await removeOne.mutateAsync(a.name)
        await addAccount.mutateAsync({ name: a.name, details: { kind: a.kind, ...none }, opening: a.opening })
      }
      for (const c of plan.create) {
        await addAccount.mutateAsync({ name: c.name, details: { kind: c.kind, ...none }, opening: c.opening })
      }
      for (const u of plan.update) {
        if (u.kind) await setDetails.mutateAsync({ account: u.name, details: { kind: u.kind, ...none } })
        if (u.balance !== undefined) {
          const amount = openingBalanceForToday(u.balance, balances.get(u.name) ?? 0, openings?.get(u.name) ?? 0)
          await setOpening.mutateAsync({ account: u.name, amount })
        }
      }
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your banks.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="animate-fade-in-up flex flex-col gap-1.5">
        <h3 className="font-serif text-2xl font-semibold leading-tight text-slate-900">Which banks do you use?</h3>
        <p className="text-sm text-slate-600">
          Tap your banks and add what's in each today. The ones you don't pick are removed, so your lists only show your banks.
        </p>
      </div>

      {chosen.size > 0 && (
        <ul className="stagger-rows flex flex-col gap-2" aria-label="Your banks">
          {[...chosen].map(([name, draft]) => (
            <li key={name} className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent-light/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className="animate-pop-in flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                    <Check size={12} strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span className="truncate">{name}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => unchoose(name)}
                  className="-my-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-white/70"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-full border border-app-border bg-white p-0.5" role="group" aria-label={`${name} account type`}>
                  {(['savings', 'current'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={draft.kind === k}
                      onClick={() => patch(name, { kind: k })}
                      className={clsx(
                        'min-h-[36px] rounded-full px-3 text-helper font-semibold transition-colors',
                        draft.kind === k ? 'bg-accent text-white' : 'text-slate-600'
                      )}
                    >
                      {k === 'savings' ? 'Savings' : 'Current'}
                    </button>
                  ))}
                </div>
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-app-border bg-white px-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
                  <span className="shrink-0 text-helper text-slate-500">Balance today</span>
                  <input
                    inputMode="decimal"
                    value={draft.balance}
                    onChange={(e) => patch(name, { balance: e.target.value })}
                    placeholder={inUse.has(name) ? 'Keep as is' : '0'}
                    aria-label={`${name} balance today`}
                    className="min-h-[40px] min-w-0 flex-1 bg-transparent text-right text-sm tabular-nums focus:outline-none"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex min-h-[44px] items-center gap-2 rounded-xl border border-app-border bg-white px-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (available.length === 1) {
                  choose(available[0])
                  setQuery('')
                } else if (typedIsNew) addTyped()
              }
            }}
            placeholder="Find your bank"
            aria-label="Find your bank"
            className="min-h-[42px] min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>
        <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto py-0.5">
          {available.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => choose(b)}
              className="press min-h-[36px] rounded-full border border-app-border bg-app-card px-3 text-helper font-medium text-slate-700 hover:border-accent hover:text-accent-dark"
            >
              {b}
            </button>
          ))}
          {typedIsNew && (
            <button
              type="button"
              onClick={addTyped}
              className="press flex min-h-[36px] items-center gap-1 rounded-full border border-dashed border-accent px-3 text-helper font-semibold text-accent-dark"
            >
              <Plus size={14} aria-hidden="true" /> Add “{query.trim()}”
            </button>
          )}
          {available.length === 0 && !typedIsNew && (
            <p className="text-helper text-slate-500">{q ? 'No bank by that name. Type its full name to add it.' : 'Every bank is picked.'}</p>
          )}
        </div>
      </div>

      {error && <InlineMessage tone="error">{error}</InlineMessage>}

      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={saving || !ready}>
          {saving ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
