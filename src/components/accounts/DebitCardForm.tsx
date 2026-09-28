import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useAuth } from '@/context/AuthContext'
import { useAddDebitCard, useUpdateDebitCard } from '@/hooks/useDebitCards'
import { useMyTransactions } from '@/hooks/useTransactions'
import { normalizeLast4, type DebitCard } from '@/lib/debitCards'
import { friendlyAccountError } from './accountErrors'

const PICK_ACCOUNT = 'Choose an account'

interface DebitCardFormProps {
  /** The card to edit; omit to add one. */
  card?: DebitCard
  /** Savings/current accounts the card can draw from. */
  bankAccounts: string[]
  defaultAccount?: string
  idPrefix: string
  onSaved: (name: string) => void
  onCancel?: () => void
  cancelLabel?: string
  onRemove?: () => void
}

/** A debit card is its own item, but every purchase with it comes out of the linked account. */
export function DebitCardForm({
  card,
  bankAccounts,
  defaultAccount,
  idPrefix,
  onSaved,
  onCancel,
  cancelLabel = 'Cancel',
  onRemove,
}: DebitCardFormProps) {
  const addCard = useAddDebitCard()
  const updateCard = useUpdateDebitCard()
  const { userId } = useAuth()
  const { data: transactions } = useMyTransactions(userId)
  // Past purchases stay on the account they came out of, so the database won't move a card that has any.
  const hasPurchases = useMemo(
    () => !!card && (transactions ?? []).some((t) => t.debit_card_id === card.id),
    [card, transactions]
  )

  const options = card && !bankAccounts.includes(card.account) ? [card.account, ...bankAccounts] : bankAccounts
  const [account, setAccount] = useState(card?.account ?? defaultAccount ?? (options.length === 1 ? options[0] : PICK_ACCOUNT))
  const [name, setName] = useState(card?.name ?? '')
  const [last4, setLast4] = useState(card?.last4 ?? '')
  const [error, setError] = useState<string | null>(null)
  const saving = addCard.isPending || updateCard.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (account === PICK_ACCOUNT) return setError('Choose the account this card spends from.')
    const trimmed = name.trim()
    if (!trimmed) return setError('Give the card a name.')
    let digits: string | null
    try {
      digits = normalizeLast4(last4)
    } catch {
      return setError('The last 4 digits must be 4 numbers.')
    }
    try {
      if (card) {
        const patch: { id: string; name?: string; last4?: string | null; account?: string } = { id: card.id }
        if (trimmed !== card.name) patch.name = trimmed
        if (digits !== card.last4) patch.last4 = digits
        if (account !== card.account && !hasPurchases) patch.account = account
        if (Object.keys(patch).length > 1) await updateCard.mutateAsync(patch)
      } else {
        await addCard.mutateAsync({ name: trimmed, last4: digits, account })
      }
      onSaved(trimmed)
    } catch (err) {
      setError(friendlyAccountError(err, 'Could not save this card.'))
    }
  }

  if (options.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          A debit card spends from a savings or current account. Add that account first, then add its card.
        </p>
        {onCancel && (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onCancel}>
              Close
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <label className="text-helper font-medium text-slate-600">Spends from</label>
        <Dropdown
          options={account === PICK_ACCOUNT ? [PICK_ACCOUNT, ...options] : options}
          value={account}
          aria-label="Account this card spends from"
          disabled={hasPurchases}
          onChange={(e) => setAccount(e.target.value)}
        />
        <p className="text-helper text-slate-500">
          {hasPurchases
            ? `This card already has purchases on ${card!.account}, so it stays linked there. Add a new card for another account.`
            : 'Purchases with this card come out of this account’s balance.'}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-[1fr_7.5rem]">
        <TextField
          id={`${idPrefix}-card-name`}
          label="Card name"
          autoComplete="off"
          placeholder="e.g. HDFC Millennia Debit"
          value={name}
          onChange={(e) => setName(e.target.value)}
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

      {error && <InlineMessage tone="error">{error}</InlineMessage>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {card && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            className="press inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-medium text-danger hover:bg-danger-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
              {cancelLabel}
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : card ? 'Save' : 'Add card'}
          </Button>
        </div>
      </div>
    </form>
  )
}
