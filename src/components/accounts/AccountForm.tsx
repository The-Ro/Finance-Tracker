import { forwardRef, useImperativeHandle, useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { Archive, ArchiveRestore } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { AccountKindIcon } from '@/components/ui/AccountKindIcon'
import { useAuth } from '@/context/AuthContext'
import {
  useAccountDetails,
  useAccountOpeningBalances,
  useSetAccountClosed,
  useSetAccountDetails,
  useSetAccountOpeningBalance,
  useSetCardNetwork,
} from '@/hooks/useLookupLists'
import type { CardNetwork } from '@/types/database.types'
import { CardNetworkPicker } from './CardNetworkPicker'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAccountBalances } from '@/hooks/useTransactions'
import { useDebitCards } from '@/hooks/useDebitCards'
import {
  ACCOUNT_KINDS,
  ACCOUNT_KIND_LABELS,
  isBankKind,
  openingToOwed,
  owedToOpening,
  type AccountDetails,
  type AccountKind,
} from '@/lib/creditCards'
import { openingBalanceForToday, parseBalance } from '@/lib/onboardingAccounts'
import { friendlyAccountError } from './accountErrors'

const SHORT_KIND_LABELS: Record<AccountKind, string> = {
  savings: 'Savings',
  current: 'Current',
  credit_card: 'Credit card',
  cash: 'Cash',
  wallet: 'Wallet',
}

const asInput = (n: number) => (n === 0 ? '' : String(Math.round(n * 100) / 100))

function dayOrNull(value: string): number | null | 'invalid' {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 'invalid'
}

export interface AccountFormHandle {
  /** Saves the form; resolves true on success. */
  saveIfDirty: () => Promise<boolean>
}

interface AccountFormProps {
  account: string
  /** Onboarding: no card limit or bill dates (they can be added later in Settings). */
  compact?: boolean
  /** The cash account every user always has: its balance can change, but not its type, and it can't be closed or removed. */
  permanent?: boolean
  idPrefix: string
  onSaved: (name: string, kind: AccountKind) => void
  onCancel?: () => void
  onRemove?: () => void
  /** Offers Close / Reopen; called after the change is saved. */
  onClosedChange?: (name: string, closed: boolean) => void
  /** The form's id, so a Save in the sheet header can submit it. */
  formId?: string
  /** Save / Remove / Cancel live in the sheet header (Modal headerActions); Close / Reopen stays here. */
  hideActions?: boolean
}

/**
 * Edit one account: its type, and "balance today" (or "amount owed today" for
 * a credit card, as a positive number). What's stored is the opening balance,
 * worked out from the transactions already logged. New accounts go through
 * AddAccountFlow.
 */
export const AccountForm = forwardRef<AccountFormHandle, AccountFormProps>(function AccountForm(
  { account, compact = false, permanent = false, idPrefix, onSaved, onCancel, onRemove, onClosedChange, formId, hideActions = false },
  ref
) {
  const { userId } = useAuth()
  const { format } = useFormatCurrency()
  const setClosed = useSetAccountClosed()
  const { data: detailsMap } = useAccountDetails()
  const { data: openings } = useAccountOpeningBalances()
  const balances = useAccountBalances(userId)
  const { data: debitCards = [] } = useDebitCards()
  const setDetails = useSetAccountDetails()
  const setOpening = useSetAccountOpeningBalance()
  const setNetworkRpc = useSetCardNetwork()

  const original = detailsMap?.get(account)
  const originalKind = original?.kind ?? 'savings'
  const currentOpening = openings?.get(account) ?? 0
  const currentBalance = balances.get(account) ?? currentOpening
  const cardCount = debitCards.filter((c) => c.account === account).length

  const [kind, setKind] = useState<AccountKind>(originalKind)
  const [balance, setBalance] = useState(() => asInput(currentBalance))
  const [owed, setOwed] = useState(() => asInput(openingToOwed(currentBalance)))
  const [limit, setLimit] = useState(original?.creditLimit != null ? String(original.creditLimit) : '')
  const [statementDay, setStatementDay] = useState(original?.statementDay != null ? String(original.statementDay) : '')
  const [dueDay, setDueDay] = useState(original?.dueDay != null ? String(original.dueDay) : '')
  const [network, setNetwork] = useState<CardNetwork | null>(original?.network ?? null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isCard = kind === 'credit_card'

  const save = async (): Promise<boolean> => {
    setError(null)
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
    } else if (isCard && original?.kind === 'credit_card') {
      creditLimit = original.creditLimit
      sDay = original.statementDay
      dDay = original.dueDay
    }
    if (cardCount > 0 && !isBankKind(kind)) {
      setError('This account still has debit cards. Move them to another account or remove them first.')
      return false
    }

    const details: AccountDetails = { kind, creditLimit, statementDay: sDay, dueDay: dDay }
    // The balance the user wants to see today, in the stored sign (a card that's owed money is negative).
    const desired = isCard ? owedToOpening(value) : value

    setSaving(true)
    try {
      const changed =
        original?.kind !== details.kind ||
        (original?.creditLimit ?? null) !== details.creditLimit ||
        (original?.statementDay ?? null) !== details.statementDay ||
        (original?.dueDay ?? null) !== details.dueDay
      if (changed) await setDetails.mutateAsync({ account, details })
      // After the kind is saved: only a credit card keeps a network.
      if (isCard && network !== (original?.network ?? null)) await setNetworkRpc.mutateAsync({ account, network })
      const opening = openingBalanceForToday(desired, currentBalance, currentOpening)
      if (opening !== currentOpening) await setOpening.mutateAsync({ account, amount: opening })
      onSaved(account, kind)
      return true
    } catch (e) {
      setError(friendlyAccountError(e, 'Could not save this account.'))
      return false
    } finally {
      setSaving(false)
    }
  }

  useImperativeHandle(ref, () => ({ saveIfDirty: save }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void save()
  }

  const isClosed = !!original?.closed
  const toggleClosed = async () => {
    setError(null)
    try {
      await setClosed.mutateAsync({ account, closed: !isClosed })
      onClosedChange?.(account, !isClosed)
    } catch (e) {
      setError(friendlyAccountError(e, 'Could not update this account.'))
    }
  }

  const busy = saving || setClosed.isPending
  const shownBalance = originalKind === 'credit_card' ? `${format(openingToOwed(currentBalance))} owed` : format(currentBalance)
  // A closed cash account from before Cash became permanent can still be reopened.
  const canClose = !!onClosedChange && (!permanent || isClosed)
  const canRemove = !permanent && !!onRemove

  return (
    <form id={formId} className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {isClosed && (
        <p className="rounded-xl bg-slate-100 px-3 py-2.5 text-helper text-slate-600">
          This account is closed. Its history stays; it’s hidden from new entries, totals and bills.
        </p>
      )}
      {permanent ? (
        <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-helper text-slate-600">
          <AccountKindIcon kind="cash" size={15} className="shrink-0 text-accent-dark" />
          Cash is always here. You can change what’s in it, but it can’t be closed or removed.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span id={`${idPrefix}-kind-label`} className="text-helper font-medium text-slate-600">
            Type
          </span>
          <div role="group" aria-labelledby={`${idPrefix}-kind-label`} className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {ACCOUNT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k)
                  setError(null)
                }}
                className={clsx(
                  'flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-medium transition-colors',
                  kind === k
                    ? 'border-accent bg-accent-light text-accent-on-light'
                    : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
                )}
              >
                <AccountKindIcon kind={k} size={15} className="shrink-0" />
                <span className="truncate">{SHORT_KIND_LABELS[k]}</span>
              </button>
            ))}
          </div>
          {kind !== originalKind && (
            <p className="text-helper text-slate-500">
              {cardCount > 0 && !isBankKind(kind)
                ? `${account} has debit cards, so it has to stay a savings or current account.`
                : `It will count as a ${ACCOUNT_KIND_LABELS[kind].toLowerCase()} from now on: its balance is shown and totalled that way everywhere.`}
            </p>
          )}
        </div>
      )}

      {isCard ? (
        <>
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
            <p className="text-helper text-slate-500">
              What you owe on this card right now. Leave it empty if nothing. Use a minus sign if the card is in credit.
            </p>
          </div>
          {!compact && (
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
          )}
          <CardNetworkPicker
            value={network}
            onChange={setNetwork}
            idPrefix={idPrefix}
            hint="A RuPay credit card can pay by UPI, so it's offered for UPI entries too."
          />
          {!compact && (
            <p className="text-helper text-slate-500">
              With both days set, each bill shows on the Bills calendar. Spending counts when you buy; paying the bill is
              a transfer from your bank to the card.
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <TextField
            id={`${idPrefix}-balance`}
            label="Balance today"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
          <p className="text-helper text-slate-500">
            What’s in it right now. LedgeEaze works out the starting balance from the transactions you’ve logged.
          </p>
        </div>
      )}

      {canClose && !isClosed && Math.abs(currentBalance) >= 0.01 && (
        <p className="text-helper text-slate-500">
          {account} currently shows {shownBalance}. Closing it removes that from your totals; settle or transfer it
          first if it’s real money.{cardCount > 0 && ' Its debit cards close with it.'}
        </p>
      )}

      {error && <InlineMessage tone="error">{error}</InlineMessage>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {canClose || (canRemove && !hideActions) ? (
          <div className="flex flex-wrap items-center gap-1">
            {canClose && (
              <Button type="button" variant="secondary" onClick={toggleClosed} disabled={busy} className="gap-2">
                {isClosed ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
                {isClosed ? 'Reopen' : 'Close account'}
              </Button>
            )}
            {canRemove && !hideActions && (
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="press inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-medium text-danger hover:bg-danger-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        ) : (
          <span />
        )}
        {!hideActions && (
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
        )}
      </div>
    </form>
  )
})
