import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CreditCard, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useAccountDetails, useAccounts, useSetAccountDetails } from '@/hooks/useLookupLists'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { ACCOUNT_KIND_LABELS, type AccountKind } from '@/lib/creditCards'

const PICK_ACCOUNT = 'Choose an account'
const KINDS: AccountKind[] = ['bank', 'credit_card', 'cash', 'wallet']

function dayOrNull(value: string): number | null | 'invalid' {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 'invalid'
}

/**
 * Account types: a credit card is money you owe, not money you have, so it's
 * shown as "owed / available" and its bills (last statement minus payments
 * since) appear on the Bills calendar. Debit cards aren't accounts -- pick
 * "Debit card" as the payment method on the bank account instead.
 */
export function AccountTypes() {
  const { data: accounts = [] } = useAccounts()
  const { data: details } = useAccountDetails()
  const setDetails = useSetAccountDetails()
  const { format } = useFormatCurrency()

  const [account, setAccount] = useState(PICK_ACCOUNT)
  const [kind, setKind] = useState<AccountKind>('bank')
  const [limit, setLimit] = useState('')
  const [statementDay, setStatementDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const nonBank = useMemo(
    () => accounts.map((name) => ({ name, d: details?.get(name) })).filter((a) => a.d && a.d.kind !== 'bank'),
    [accounts, details]
  )

  const pick = (name: string) => {
    setAccount(name)
    setError(null)
    setSaved(null)
    const d = details?.get(name)
    setKind(d?.kind ?? 'bank')
    setLimit(d?.creditLimit != null ? String(d.creditLimit) : '')
    setStatementDay(d?.statementDay != null ? String(d.statementDay) : '')
    setDueDay(d?.dueDay != null ? String(d.dueDay) : '')
  }

  const handleSave = async () => {
    setError(null)
    setSaved(null)
    if (account === PICK_ACCOUNT) return setError('Choose an account first.')
    let creditLimit: number | null = null
    let sDay: number | null = null
    let dDay: number | null = null
    if (kind === 'credit_card') {
      if (limit.trim() !== '') {
        creditLimit = Number(limit)
        if (!Number.isFinite(creditLimit) || creditLimit <= 0) return setError('The credit limit must be more than zero.')
      }
      const s = dayOrNull(statementDay)
      const d = dayOrNull(dueDay)
      if (s === 'invalid' || d === 'invalid') return setError('Statement and due days are a day of the month, 1 to 31.')
      if ((s === null) !== (d === null)) return setError('Add both the statement day and the due day, or neither.')
      sDay = s
      dDay = d
    }
    try {
      await setDetails.mutateAsync({ account, details: { kind, creditLimit, statementDay: sDay, dueDay: dDay } })
      setSaved(`${account} saved as ${ACCOUNT_KIND_LABELS[kind].toLowerCase()}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this account.')
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Account types and cards</h3>
        <p className="mt-1 text-helper text-slate-500">
          Mark credit cards so LedgeEaze shows what you owe and your available credit, and puts each card's bill on
          the Bills calendar. Spending on a card counts when you buy; paying the bill is a transfer. Debit cards aren't
          separate accounts: log those spends on the bank account with "Debit card" as the payment method.
        </p>
      </div>

      {nonBank.length > 0 && (
        <ul className="flex flex-col gap-2">
          {nonBank.map(({ name, d }) => (
            <li key={name} className="flex items-center justify-between gap-3 rounded-lg border border-app-border px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm text-slate-800">
                {d!.kind === 'credit_card' && <CreditCard size={14} className="shrink-0 text-slate-400" aria-hidden="true" />}
                <span className="truncate">{name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="text-helper text-slate-500">
                  {ACCOUNT_KIND_LABELS[d!.kind]}
                  {d!.creditLimit != null ? ` · limit ${format(d!.creditLimit)}` : ''}
                  {d!.statementDay != null ? ` · statement ${d!.statementDay}, due ${d!.dueDay}` : ''}
                </span>
                <button
                  type="button"
                  aria-label={`Edit ${name}`}
                  onClick={() => pick(name)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-helper font-medium text-slate-600">Account</label>
        <Dropdown options={accounts} value={account} aria-label="Account to set up" onChange={(e) => pick(e.target.value)} />
      </div>

      {account !== PICK_ACCOUNT && (
        <>
          <div role="group" aria-label="Account type" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={clsx(
                  'min-h-[40px] rounded-xl border px-3 text-sm font-medium transition-colors',
                  kind === k
                    ? 'border-accent bg-accent-light text-accent-on-light'
                    : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
                )}
              >
                {ACCOUNT_KIND_LABELS[k]}
              </button>
            ))}
          </div>

          {kind === 'credit_card' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField label="Credit limit (optional)" type="number" step="0.01" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} />
              <TextField label="Statement day" type="number" min="1" max="31" placeholder="e.g. 12" value={statementDay} onChange={(e) => setStatementDay(e.target.value)} />
              <TextField label="Payment due day" type="number" min="1" max="31" placeholder="e.g. 2" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={setDetails.isPending}>
              {setDetails.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </>
      )}
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      {saved && <InlineMessage tone="success">{saved}</InlineMessage>}
    </Card>
  )
}
