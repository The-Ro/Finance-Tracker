import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { TextField } from '@/components/ui/TextField'
import { useConvertAccountToDebitCard, type ConvertResult } from '@/hooks/useDebitCards'
import { normalizeLast4 } from '@/lib/debitCards'
import { friendlyAccountError } from './accountErrors'
import { guessLinkedAccount } from './linkedAccountGuess'
import { FormError } from '@/components/ui/FieldError'

const PICK_ACCOUNT = 'Choose an account'

interface ConvertDebitCardFormProps {
  account: string
  /** Savings/current accounts to move it onto (never the account itself). */
  bankAccounts: string[]
  transactionCount: number
  onDone: (result: ConvertResult & { account: string; linkedAccount: string }) => void
  onCancel: () => void
}

export function ConvertDebitCardForm({ account, bankAccounts, transactionCount, onDone, onCancel }: ConvertDebitCardFormProps) {
  const convert = useConvertAccountToDebitCard()
  const targets = bankAccounts.filter((b) => b !== account)
  const [linked, setLinked] = useState(guessLinkedAccount(account, targets) ?? (targets.length === 1 ? targets[0] : PICK_ACCOUNT))
  const [last4, setLast4] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (linked === PICK_ACCOUNT) return setError('Choose the account this card really spends from.')
    try {
      normalizeLast4(last4)
    } catch {
      return setError('The last 4 digits must be 4 numbers.')
    }
    try {
      const result = await convert.mutateAsync({ account, linkedAccount: linked, last4 })
      onDone({ ...result, account, linkedAccount: linked })
    } catch (err) {
      setError(friendlyAccountError(err, 'Could not convert this account.'))
    }
  }

  if (targets.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          Add the savings or current account this card spends from first, then convert {account} into its debit card.
        </p>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  const target = linked === PICK_ACCOUNT ? 'that account' : linked

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <p className="text-sm text-slate-600">
        {account} is set up as a separate account, so what you spend with it doesn’t come out of your bank balance.
        Converting makes it a debit card on the account it really spends from.
      </p>
      <div className="flex flex-col gap-1.5">
        <label className="text-helper font-medium text-slate-600">Spends from</label>
        <Dropdown
          options={linked === PICK_ACCOUNT ? [PICK_ACCOUNT, ...targets] : targets}
          value={linked}
          aria-label="Account this card spends from"
          onChange={(e) => setLinked(e.target.value)}
        />
      </div>
      <TextField
        id="convert-card-last4"
        label="Last 4 digits (optional)"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        placeholder="1234"
        value={last4}
        onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
      />
      <ul className="flex list-disc flex-col gap-1 pl-5 text-helper text-slate-500">
        <li>
          Its {transactionCount === 1 ? 'transaction moves' : `${transactionCount} transactions move`} to {target}, paid with this
          card.
        </li>
        <li>Transfers between the two are removed, since they’d be a transfer to itself.</li>
        <li>Its starting balance is added to {target}’s, and the separate account goes away.</li>
      </ul>

      <FormError message={error} />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={convert.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={convert.isPending}>
          {convert.isPending ? 'Converting…' : 'Convert'}
        </Button>
      </div>
    </form>
  )
}
