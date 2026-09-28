import { forwardRef, useImperativeHandle, useMemo, useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { AccountKindIcon, DebitCardIcon } from '@/components/ui/AccountKindIcon'
import { useAccountDetails, useAccounts, useAddAccount } from '@/hooks/useLookupLists'
import { useAddDebitCard, useDebitCards } from '@/hooks/useDebitCards'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { isBankKind, owedToOpening, type AccountKind } from '@/lib/creditCards'
import { normalizeLast4 } from '@/lib/debitCards'
import { matchAccountName, parseBalance } from '@/lib/onboardingAccounts'
import { defaultDebitCardName, WALLET_SUGGESTIONS, type AddAccountType } from './addAccount'
import { friendlyAccountError } from './accountErrors'

const TYPE_A_NAME = 'Another bank (type its name)'

const TYPES: { type: AddAccountType; kind: AccountKind; title: string; subtitle: string }[] = [
  { type: 'bank', kind: 'savings', title: 'Bank account', subtitle: 'Savings or current, with its debit card' },
  { type: 'credit', kind: 'credit_card', title: 'Credit card', subtitle: 'What you owe, your limit and bill dates' },
  { type: 'wallet', kind: 'wallet', title: 'Wallet', subtitle: 'Paytm, PhonePe, Amazon Pay…' },
]

function dayOrNull(value: string): number | null | 'invalid' {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 'invalid'
}

export interface AddAccountResult {
  name: string
  kind: AccountKind
  /** The debit card added with a bank account, if any. */
  debitCard: string | null
  /** Set when the account was added but its debit card couldn't be. */
  debitCardError: string | null
}

export interface AddAccountFlowHandle {
  /** Adds what's been typed on the details step; resolves true on success or when nothing was typed. */
  saveIfDirty: () => Promise<boolean>
}

interface AddAccountFlowProps {
  /** Skip the type question and open on this type (Back still offers the others). */
  initialType?: AddAccountType
  /** Onboarding: no card limit or bill dates (they can be added later in Settings). */
  compact?: boolean
  idPrefix: string
  onDone: (result: AddAccountResult) => void
  onCancel?: () => void
  cancelLabel?: string
}

/**
 * Adding an account asks what it is first -- a bank account (savings or
 * current, optionally with the debit card that spends from it), a credit card
 * or a wallet -- then only that type's fields. Cash isn't offered: every user
 * always has it.
 */
export const AddAccountFlow = forwardRef<AddAccountFlowHandle, AddAccountFlowProps>(function AddAccountFlow(
  { initialType, compact = false, idPrefix, onDone, onCancel, cancelLabel = 'Cancel' },
  ref
) {
  const accounts = useAccounts()
  const { data: detailsMap } = useAccountDetails()
  const { data: debitCards = [] } = useDebitCards()
  const { inUse, ready } = useAccountsInUse()
  const addAccount = useAddAccount()
  const addDebitCard = useAddDebitCard()

  const [type, setType] = useState<AddAccountType | null>(initialType ?? null)
  const [bankPick, setBankPick] = useState(TYPE_A_NAME)
  // Each type keeps what was typed for it, so going Back and picking another type starts clean.
  const [names, setNames] = useState<Record<AddAccountType, string>>({ bank: '', credit: '', wallet: '' })
  const [balances, setBalances] = useState<Record<'bank' | 'wallet', string>>({ bank: '', wallet: '' })
  const [bankKind, setBankKind] = useState<'savings' | 'current'>('savings')
  const [owed, setOwed] = useState('')
  const [limit, setLimit] = useState('')
  const [statementDay, setStatementDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [withDebit, setWithDebit] = useState(true)
  const [debitTouched, setDebitTouched] = useState(false)
  const [cardName, setCardName] = useState('')
  const [cardNameTouched, setCardNameTouched] = useState(false)
  const [last4, setLast4] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const accountNames = useMemo(() => accounts.data ?? [], [accounts.data])
  // Seeded banks nobody uses yet: picked from a list instead of typed.
  const unusedBanks = useMemo(
    () => (ready ? accountNames.filter((n) => !inUse.has(n) && isBankKind(detailsMap?.get(n)?.kind ?? 'savings')) : []),
    [accountNames, inUse, ready, detailsMap]
  )

  const name = type ? names[type] : ''
  const setName = (value: string) => type && setNames((n) => ({ ...n, [type]: value }))
  const balance = type === 'bank' || type === 'wallet' ? balances[type] : ''
  const setBalance = (value: string) => (type === 'bank' || type === 'wallet') && setBalances((b) => ({ ...b, [type]: value }))

  const showBankPicker = type === 'bank' && unusedBanks.length > 0
  const accountName = (showBankPicker && bankPick !== TYPE_A_NAME ? bankPick : name).trim()
  const shownCardName = cardNameTouched ? cardName : defaultDebitCardName(accountName)
  const dirty =
    type !== null && (accountName !== '' || balance.trim() !== '' || (type === 'credit' && owed.trim() !== ''))

  const chooseType = (t: AddAccountType) => {
    setType(t)
    setError(null)
  }

  const chooseBankKind = (k: 'savings' | 'current') => {
    setBankKind(k)
    if (!debitTouched) setWithDebit(k === 'savings')
  }

  const save = async (): Promise<boolean> => {
    if (!type) return true
    setError(null)
    if (!accountName) {
      setError(type === 'credit' ? 'Give the card a name.' : type === 'wallet' ? 'Give the wallet a name.' : 'Choose or type the bank.')
      return false
    }
    const existing = matchAccountName(accountName, accountNames)
    if (existing && inUse.has(existing)) {
      setError(`You already have an account called ${existing}.`)
      return false
    }

    const isCard = type === 'credit'
    const value = parseBalance(isCard ? owed : balance)
    if (value === null) {
      setError(isCard ? 'Enter what you owe as a number, like 12500.' : 'Enter the balance as a number, like 25000.')
      return false
    }

    let creditLimit: number | null = null
    let sDay: number | null = null
    let dDay: number | null = null
    if (isCard && !compact) {
      if (limit.trim() !== '') {
        creditLimit = parseBalance(limit)
        if (creditLimit === null || creditLimit <= 0) {
          setError('The credit limit must be more than zero.')
          return false
        }
      }
      const s = dayOrNull(statementDay)
      const d = dayOrNull(dueDay)
      if (s === 'invalid' || d === 'invalid') {
        setError('Statement and due days are a day of the month, 1 to 31.')
        return false
      }
      if ((s === null) !== (d === null)) {
        setError('Add both the statement day and the due day, or neither.')
        return false
      }
      sDay = s
      dDay = d
    }

    const addCard = type === 'bank' && withDebit
    let digits: string | null = null
    const trimmedCard = shownCardName.trim()
    if (addCard) {
      if (!trimmedCard) {
        setError('Give the debit card a name, or turn off “Add its debit card”.')
        return false
      }
      if (debitCards.some((c) => c.name.trim().toLowerCase() === trimmedCard.toLowerCase())) {
        setError(`You already have a debit card called ${trimmedCard}. Give this one another name.`)
        return false
      }
      try {
        digits = normalizeLast4(last4)
      } catch {
        setError('The last 4 digits must be 4 numbers.')
        return false
      }
    }

    const kind: AccountKind = type === 'credit' ? 'credit_card' : type === 'wallet' ? 'wallet' : bankKind
    const target = existing ?? accountName
    setSaving(true)
    try {
      // A seeded bank nobody has used: re-create it as the user's own, so it counts as theirs from now on.
      if (existing) await accounts.remove.mutateAsync(existing)
      await addAccount.mutateAsync({
        name: target,
        details: { kind, creditLimit, statementDay: sDay, dueDay: dDay },
        opening: isCard ? owedToOpening(value) : value,
      })
    } catch (e) {
      setError(friendlyAccountError(e, 'Could not add this account.'))
      setSaving(false)
      return false
    }

    let debitCardError: string | null = null
    if (addCard) {
      try {
        await addDebitCard.mutateAsync({ name: trimmedCard, last4: digits, account: target })
      } catch (e) {
        debitCardError = friendlyAccountError(e, 'Could not add the debit card.')
      }
    }
    setSaving(false)
    onDone({ name: target, kind, debitCard: addCard && !debitCardError ? trimmedCard : null, debitCardError })
    return true
  }

  useImperativeHandle(ref, () => ({ saveIfDirty: () => (dirty ? save() : Promise.resolve(true)) }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void save()
  }

  if (type === null) {
    return (
      <div className="flex flex-col gap-3">
        <p id={`${idPrefix}-type-question`} className="text-sm font-medium text-slate-700">
          What would you like to add?
        </p>
        <ul aria-labelledby={`${idPrefix}-type-question`} className="stagger-rows flex flex-col gap-2">
          {TYPES.map((t) => (
            <li key={t.type}>
              <button
                type="button"
                onClick={() => chooseType(t.type)}
                className="press card-interactive flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-app-border bg-app-card px-4 py-3 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-on-light">
                  <AccountKindIcon kind={t.kind} size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-slate-900">{t.title}</span>
                  <span className="text-helper text-slate-500">{t.subtitle}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <p className="text-helper text-slate-500">Cash is always here, so there’s nothing to add for it.</p>
        {onCancel && (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
        )}
      </div>
    )
  }

  const current = TYPES.find((t) => t.type === type)!
  const busy = saving

  return (
    <form className="animate-fade-in-up flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setType(null)
            setError(null)
          }}
          disabled={busy}
          className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-medium text-accent-dark hover:bg-slate-50 disabled:opacity-50"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Back
        </button>
        <span className="ml-auto flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
          <AccountKindIcon kind={type === 'bank' ? bankKind : current.kind} size={16} className="shrink-0 text-accent-dark" />
          <span className="truncate">{current.title}</span>
        </span>
      </div>

      {type === 'bank' && (
        <>
          {showBankPicker ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-helper font-medium text-slate-600">Bank</label>
                <Dropdown options={[TYPE_A_NAME, ...unusedBanks]} value={bankPick} aria-label="Bank" onChange={(e) => setBankPick(e.target.value)} />
              </div>
              {bankPick === TYPE_A_NAME && (
                <TextField
                  id={`${idPrefix}-name`}
                  label="Bank or account name"
                  autoComplete="off"
                  placeholder="e.g. HDFC Bank"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </div>
          ) : (
            <TextField
              id={`${idPrefix}-name`}
              label="Bank or account name"
              autoComplete="off"
              placeholder="e.g. HDFC Bank"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <span id={`${idPrefix}-bank-kind`} className="text-helper font-medium text-slate-600">
              Account type
            </span>
            <div role="group" aria-labelledby={`${idPrefix}-bank-kind`} className="grid grid-cols-2 gap-1.5">
              {(['savings', 'current'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={bankKind === k}
                  onClick={() => chooseBankKind(k)}
                  className={clsx(
                    'flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-medium transition-colors',
                    bankKind === k
                      ? 'border-accent bg-accent-light text-accent-on-light'
                      : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
                  )}
                >
                  <AccountKindIcon kind={k} size={15} className="shrink-0" />
                  {k === 'savings' ? 'Savings' : 'Current'}
                </button>
              ))}
            </div>
          </div>

          <BalanceField idPrefix={idPrefix} value={balance} onChange={setBalance} />

          <div className="flex flex-col gap-3 rounded-xl border border-app-border p-3">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent-on-light">
                <DebitCardIcon size={17} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-slate-900">Add its debit card</span>
                <span className="text-helper text-slate-500">Purchases with it come out of this account.</span>
              </span>
              <input
                type="checkbox"
                checked={withDebit}
                onChange={(e) => {
                  setWithDebit(e.target.checked)
                  setDebitTouched(true)
                }}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={clsx(
                  'relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2',
                  withDebit ? 'bg-accent' : 'bg-slate-300'
                )}
              >
                <span
                  className={clsx(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    withDebit ? 'translate-x-[22px]' : 'translate-x-0.5'
                  )}
                />
              </span>
            </label>
            {withDebit && (
              <div className="animate-fade-in-up grid grid-cols-1 gap-3 min-[360px]:grid-cols-[1fr_7.5rem]">
                <TextField
                  id={`${idPrefix}-card-name`}
                  label="Card name"
                  autoComplete="off"
                  placeholder="e.g. HDFC Bank Debit"
                  value={shownCardName}
                  onChange={(e) => {
                    setCardName(e.target.value)
                    setCardNameTouched(true)
                  }}
                />
                <TextField
                  id={`${idPrefix}-card-last4`}
                  label="Last 4 digits"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="1234"
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            )}
          </div>
        </>
      )}

      {type === 'credit' && (
        <>
          <TextField
            id={`${idPrefix}-name`}
            label="Card name"
            autoComplete="off"
            placeholder="e.g. HDFC Millennia Credit Card"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <TextField
              id={`${idPrefix}-owed`}
              label="Amount owed today"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={owed}
              onChange={(e) => setOwed(e.target.value)}
            />
            <p className="text-helper text-slate-500">What you owe on it right now. Leave it empty if nothing.</p>
          </div>
          {!compact && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <TextField
                  id={`${idPrefix}-limit`}
                  label="Credit limit (optional)"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                  <TextField
                    id={`${idPrefix}-statement`}
                    label="Statement day"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="e.g. 12"
                    value={statementDay}
                    onChange={(e) => setStatementDay(e.target.value)}
                  />
                  <TextField
                    id={`${idPrefix}-due`}
                    label="Payment due day"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="e.g. 2"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-helper text-slate-500">
                With both days set, each bill shows on the Bills calendar. Paying the bill is a transfer from your bank to
                the card.
              </p>
            </>
          )}
        </>
      )}

      {type === 'wallet' && (
        <>
          <div className="flex flex-col gap-2">
            <TextField
              id={`${idPrefix}-name`}
              label="Wallet name"
              autoComplete="off"
              placeholder="e.g. Paytm Wallet"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5" aria-label="Common wallets">
              {WALLET_SUGGESTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={name === w}
                  onClick={() => setName(w)}
                  className={clsx(
                    'min-h-[36px] rounded-full px-3 text-helper font-medium transition-colors',
                    name === w ? 'bg-accent-light text-accent-on-light' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <BalanceField idPrefix={idPrefix} value={balance} onChange={setBalance} />
        </>
      )}

      {error && <InlineMessage tone="error">{error}</InlineMessage>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {saving ? 'Adding…' : type === 'credit' ? 'Add card' : type === 'wallet' ? 'Add wallet' : 'Add account'}
        </Button>
      </div>
    </form>
  )
})

function BalanceField({ idPrefix, value, onChange }: { idPrefix: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <TextField
        id={`${idPrefix}-balance`}
        label="Balance today"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-helper text-slate-500">What’s in it right now.</p>
    </div>
  )
}
