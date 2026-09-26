import { useMemo, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useAccounts, useAccountOpeningBalances, useSetAccountOpeningBalance } from '@/hooks/useLookupLists'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'

const PICK_ACCOUNT = 'Choose an account'

/**
 * Per-account starting balance, added on top of the transaction-derived balance
 * everywhere balances are shown (dashboard, transfer overdraw hint, recurring
 * "insufficient balance"). Separate from the Net worth card above, which is a
 * manually-entered total not tied to any account.
 */
export function StartingBalances() {
  const { data: accounts = [] } = useAccounts()
  const { data: openingBalances } = useAccountOpeningBalances()
  const setOpening = useSetAccountOpeningBalance()
  const { format } = useFormatCurrency()

  const [account, setAccount] = useState(PICK_ACCOUNT)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const withBalance = useMemo(
    () =>
      accounts
        .map((name) => ({ name, amount: openingBalances?.get(name) ?? 0 }))
        .filter((a) => a.amount !== 0),
    [accounts, openingBalances]
  )

  const save = async (name: string, value: number) => {
    setError(null)
    try {
      await setOpening.mutateAsync({ account: name, amount: value })
      setAccount(PICK_ACCOUNT)
      setAmount('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the starting balance.')
    }
  }

  const handleSave = () => {
    if (account === PICK_ACCOUNT) return setError('Choose an account first.')
    const value = Number(amount)
    if (amount.trim() === '' || !Number.isFinite(value)) return setError('Enter a valid amount (it can be negative for a credit card).')
    save(account, value)
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Starting balances</h3>
        <p className="mt-1 text-helper text-slate-500">
          What each account held before the transactions you've logged. It's added to the balance shown
          everywhere in LedgeEaze. Use a negative amount for money owed, like a credit card.
        </p>
      </div>

      {withBalance.length > 0 && (
        <ul className="flex flex-col gap-2">
          {withBalance.map((a) => (
            <li
              key={a.name}
              className="flex items-center justify-between gap-3 rounded-lg border border-app-border px-3 py-2"
            >
              <span className="truncate text-sm text-slate-800">{a.name}</span>
              <div className="flex shrink-0 items-center gap-1">
                <span className="mr-1 text-sm font-medium tabular-nums text-slate-900">{format(a.amount)}</span>
                <button
                  type="button"
                  aria-label={`Edit ${a.name} starting balance`}
                  onClick={() => {
                    setAccount(a.name)
                    setAmount(String(a.amount))
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Clear ${a.name} starting balance`}
                  disabled={setOpening.isPending}
                  onClick={() => save(a.name, 0)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-danger-light hover:text-danger"
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-helper font-medium text-slate-600">Account</label>
          <Dropdown options={accounts} value={account} aria-label="Starting balance account" onChange={(e) => setAccount(e.target.value)} />
        </div>
        <div className="sm:w-40">
          <TextField
            label="Starting balance"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <Button onClick={handleSave} disabled={setOpening.isPending}>
          {setOpening.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
    </Card>
  )
}
