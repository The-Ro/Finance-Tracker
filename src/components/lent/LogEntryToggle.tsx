import { useMemo } from 'react'
import clsx from 'clsx'
import { Dropdown } from '@/components/ui/Dropdown'
import { useAuth } from '@/context/AuthContext'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { useClosedAccounts } from '@/hooks/useCards'
import { useAddTransaction } from '@/hooks/useTransactions'

export const PICK_ACCOUNT = 'Choose an account'

/** Which money movement a lent/borrowed record or payback is. */
export type IouEntryKind = 'lent' | 'borrowed' | 'got-back' | 'paid-back'

/**
 * The entry a lent/borrowed record logs when "Also add to my entries" is
 * ticked, so the account balance moves too: lending and paying back are money
 * out, borrowing and being paid back are money in. Category "Lent" or
 * "Borrowed" and a #lent / #borrowed tag keep them easy to find.
 */
export function iouEntry(kind: IouEntryKind, person: string) {
  const name = person.trim()
  switch (kind) {
    case 'lent':
      return { type: 'expense' as const, category: 'Lent', merchant: `Lent to ${name}`, tag: 'lent' }
    case 'borrowed':
      return { type: 'income' as const, category: 'Borrowed', merchant: `Borrowed from ${name}`, tag: 'borrowed' }
    case 'got-back':
      return { type: 'income' as const, category: 'Lent', merchant: `${name} paid back`, tag: 'lent' }
    case 'paid-back':
      return { type: 'expense' as const, category: 'Borrowed', merchant: `Paid back ${name}`, tag: 'borrowed' }
  }
}

/** Adds the entry for a lent/borrowed record or payback (see iouEntry). */
export function useLogIouEntry() {
  const add = useAddTransaction()
  return {
    isPending: add.isPending,
    log: (kind: IouEntryKind, person: string, amount: number, date: string, account: string) => {
      const e = iouEntry(kind, person)
      return add.mutateAsync({
        type: e.type,
        amount,
        merchant: e.merchant,
        date,
        category: e.category,
        account,
        tags: [e.tag],
        receipt: false,
        // Same money on the same day twice (e.g. two small loans) is fine here.
        allowDuplicate: true,
      })
    },
  }
}

/** "Also add to my entries" tick with the account it comes out of / goes into. */
export function LogEntryToggle({
  checked,
  onCheckedChange,
  account,
  onAccountChange,
  moneyIn,
  error,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  account: string
  onAccountChange: (account: string) => void
  /** True when this is money coming in (borrowed, or paid back to you). */
  moneyIn: boolean
  error?: string | null
}) {
  const { userId } = useAuth()
  const { inUse } = useAccountsInUse()
  const closed = useClosedAccounts()
  const options = useMemo(() => [...inUse].filter((a) => !closed.has(a)).sort((a, b) => a.localeCompare(b)), [inUse, closed])

  return (
    <div className={clsx('flex flex-col gap-3 rounded-xl border p-3', checked ? 'border-accent' : 'border-app-border')}>
      <label className="flex min-h-[40px] cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
        />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-slate-800">Also add to my entries</span>
          <span className="text-helper text-slate-500">
            {moneyIn ? 'Logs it as money in, so the account balance goes up.' : 'Logs it as money out, so the account balance goes down.'}
          </span>
        </span>
      </label>
      {checked && userId && (
        <div className="flex flex-col gap-1.5">
          <span className="text-helper font-medium text-slate-600">{moneyIn ? 'Into' : 'From'}</span>
          <Dropdown
            options={account === PICK_ACCOUNT ? [PICK_ACCOUNT, ...options] : options}
            value={account}
            aria-label={moneyIn ? 'Account the money goes into' : 'Account the money comes out of'}
            error={error ?? null}
            onChange={(e) => onAccountChange(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
