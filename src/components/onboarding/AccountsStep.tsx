import { useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { AccountKindIcon, DebitCardIcon } from '@/components/ui/AccountKindIcon'
import { AccountForm, type AccountFormHandle } from '@/components/accounts/AccountForm'
import { AddAccountFlow, type AddAccountFlowHandle } from '@/components/accounts/AddAccountFlow'
import { permanentCashAccount } from '@/components/accounts/addAccount'
import { useAuth } from '@/context/AuthContext'
import { useAccountOpeningBalances, useAccounts } from '@/hooks/useLookupLists'
import { useAccountBalances } from '@/hooks/useTransactions'
import { useAccountKinds } from '@/hooks/useCards'
import { useDebitCards } from '@/hooks/useDebitCards'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { ACCOUNT_KIND_LABELS, openingToOwed } from '@/lib/creditCards'
import { debitCardLabel, debitCardsByAccount } from '@/lib/debitCards'

interface AccountsStepProps {
  onBack: () => void
  onDone: () => void
  finishing: boolean
  /** Heading and line under it; defaults to the original single accounts step. */
  title?: string
  description?: string
}

/**
 * Onboarding's "Where does your money live?" step: the same type-first Add
 * account flow as Settings → Accounts & cards (a bank account with its debit
 * card, a credit card, or a wallet), each with its figure today. Cash is
 * always listed -- it's already there; tap it to set what's in it.
 */
export function AccountsStep({
  onBack,
  onDone,
  finishing,
  title = 'Where does your money live?',
  description = 'Add your bank accounts, cards and wallets with what’s in them (or owed) today, so balances start out right.',
}: AccountsStepProps) {
  const { userId } = useAuth()
  const { data: accounts = [] } = useAccounts()
  const { data: openings } = useAccountOpeningBalances()
  const balances = useAccountBalances(userId)
  const kinds = useAccountKinds()
  const { data: debitCards = [] } = useDebitCards()
  const { format } = useFormatCurrency()

  const editRef = useRef<AccountFormHandle>(null)
  const addRef = useRef<AddAccountFlowHandle>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [flowKey, setFlowKey] = useState(0)
  const [touched, setTouched] = useState<string[]>([])
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [continuing, setContinuing] = useState(false)

  const cardsByAccount = useMemo(() => debitCardsByAccount(debitCards), [debitCards])
  const cashAccount = useMemo(() => permanentCashAccount(accounts, kinds), [accounts, kinds])
  const balanceOf = (name: string) => balances.get(name) ?? openings?.get(name) ?? 0
  const listed = accounts.filter((n) => n === cashAccount || balanceOf(n) !== 0 || touched.includes(n))

  const markSaved = (name: string) => {
    setTouched((t) => (t.includes(name) ? t : [...t, name]))
    setLastSaved(name)
  }

  const handleContinue = async () => {
    setContinuing(true)
    // Anything typed but not added yet still counts -- don't silently drop it.
    const ok = editing ? ((await editRef.current?.saveIfDirty()) ?? true) : ((await addRef.current?.saveIfDirty()) ?? true)
    setContinuing(false)
    if (ok) onDone()
  }

  const busy = continuing || finishing

  return (
    <div className="flex flex-col gap-4">
      <div className="animate-fade-in-up flex flex-col gap-1.5">
        <h3 className="font-serif text-2xl font-semibold leading-tight text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>

      {listed.length > 0 && (
        <ul className="stagger-rows flex flex-col gap-2" aria-label="Your accounts">
          {listed.map((name) => {
            const kind = kinds.get(name) ?? 'savings'
            const isCard = kind === 'credit_card'
            const figure = isCard ? openingToOwed(balanceOf(name)) : balanceOf(name)
            const always = name === cashAccount
            return (
              <li key={name} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(name)}
                  aria-label={`Change ${name}, ${isCard ? `owed today ${format(figure)}` : `balance today ${format(figure)}`}`}
                  className={clsx(
                    'flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors hover:bg-slate-50',
                    editing === name ? 'border-accent' : 'border-app-border'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent-on-light',
                      lastSaved === name && 'animate-pop-in'
                    )}
                  >
                    <AccountKindIcon kind={kind} size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-slate-900">{name}</span>
                    <span className="truncate text-helper text-slate-500">
                      {always ? 'Cash in hand · Always here' : kind === 'cash' ? 'Cash in hand' : ACCOUNT_KIND_LABELS[kind]}
                    </span>
                  </span>
                  <span
                    className={clsx(
                      'shrink-0 font-serif text-base font-semibold tabular-nums',
                      isCard ? (figure > 0 ? 'text-danger' : 'text-slate-900') : figure < 0 ? 'text-danger' : 'text-slate-900'
                    )}
                  >
                    {format(figure)}
                    {isCard && figure > 0 && <span className="ml-1 font-sans text-helper font-normal text-slate-500">owed</span>}
                  </span>
                </button>
                {(cardsByAccount.get(name) ?? []).map((card) => (
                  <p key={card.id} className="flex items-center gap-2 pl-14 text-helper text-slate-500">
                    <DebitCardIcon size={13} className="shrink-0" />
                    <span className="truncate">{debitCardLabel(card)}</span>
                  </p>
                ))}
              </li>
            )
          })}
        </ul>
      )}

      {warning && <InlineMessage tone="error">{warning}</InlineMessage>}

      <div className="rounded-xl border border-app-border p-4">
        {editing ? (
          <AccountForm
            key={editing}
            ref={editRef}
            compact
            permanent={editing === cashAccount}
            idPrefix="onboarding-account"
            account={editing}
            onSaved={(name) => {
              markSaved(name)
              setEditing(null)
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <AddAccountFlow
            key={flowKey}
            ref={addRef}
            compact
            idPrefix="onboarding-add"
            onDone={(r) => {
              markSaved(r.name)
              setWarning(r.debitCardError ? `Added ${r.name}, but its debit card couldn’t be added: ${r.debitCardError}` : null)
              setFlowKey((k) => k + 1)
            }}
          />
        )}
      </div>

      <p className="text-center text-helper text-slate-500">
        You can change these later in Settings → Accounts &amp; cards, and add card limits and bill dates there.
      </p>

      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={busy}>
          {finishing ? 'Finishing…' : 'Finish'}
        </Button>
      </div>
    </div>
  )
}
