import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronRight, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { AccountKindIcon, DebitCardIcon } from '@/components/ui/AccountKindIcon'
import { useAuth } from '@/context/AuthContext'
import { useAccounts } from '@/hooks/useLookupLists'
import { useAccountBalances, useMyTransactions } from '@/hooks/useTransactions'
import { useAccountKinds, useCardStatuses, useClosedAccounts } from '@/hooks/useCards'
import { useDebitCards } from '@/hooks/useDebitCards'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { groupAccounts } from '@/lib/accountGroups'
import { debitCardsByAccount } from '@/lib/debitCards'
import { formatShortDate, todayISO } from '@/lib/format'
import { cardPagePath } from '@/components/cards/cardPath'
import { activityFilterLink } from '@/lib/activityLink'
import { utilizationTone, type UtilizationTone } from '@/lib/cardSummary'

const UTILIZATION_TEXT: Record<UtilizationTone, string> = {
  positive: 'text-positive',
  caution: 'text-caution',
  danger: 'text-danger',
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-helper font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="flex flex-col divide-y divide-app-border">{children}</ul>
    </div>
  )
}

export function AccountBalances() {
  const { userId } = useAuth()
  const { data: accounts = [] } = useAccounts()
  const balances = useAccountBalances(userId)
  const kinds = useAccountKinds()
  const cards = useCardStatuses()
  const closed = useClosedAccounts()
  const { data: debitCards = [] } = useDebitCards()
  const { data: transactions } = useMyTransactions(userId)
  const { format } = useFormatCurrency()

  const cardsByAccount = useMemo(() => debitCardsByAccount(debitCards), [debitCards])
  // This month's spending (and ATM withdrawals) per debit card.
  const monthSpend = useMemo(() => {
    const monthStart = todayISO().slice(0, 8) + '01'
    const spend = new Map<string, number>()
    for (const t of transactions ?? []) {
      if (t.debit_card_id && t.type !== 'income' && t.date >= monthStart) {
        spend.set(t.debit_card_id, (spend.get(t.debit_card_id) ?? 0) + Number(t.amount))
      }
    }
    return spend
  }, [transactions])

  // Only open accounts with a balance or a debit card -- signup seeds dozens of
  // untouched banks, and listing them all at 0 would bury the ones that matter.
  // Closed accounts keep their history but leave Home entirely.
  const groups = groupAccounts(
    accounts.filter((name) => !closed.has(name) && (balances.has(name) || cardsByAccount.has(name))),
    kinds
  )
  const byBalance = (names: string[]) =>
    names.map((name) => ({ name, balance: balances.get(name) ?? 0 })).sort((a, b) => b.balance - a.balance)
  const bankRows = byBalance(groups.bank)
  const cashRows = byBalance(groups.cashWallet)
  const cardRows = groups.credit
    .filter((name) => cards.has(name))
    .map((name) => ({ name, status: cards.get(name)! }))
    .sort((a, b) => b.status.owed - a.status.owed)

  const balanceRow = (name: string, balance: number) => (
    <li key={name} className="py-0.5 text-sm">
      {/* Tap: what happened in this account (Activity, filtered to it). */}
      <Link to={activityFilterLink({ account: name }, { start: null, end: todayISO() })} className="-mx-2 flex flex-col gap-1 rounded-lg px-2 py-2 active:bg-slate-100 [@media(hover:hover)]:hover:bg-slate-50">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-slate-700">
          <AccountKindIcon kind={kinds.get(name)} size={15} className="shrink-0 text-slate-400" />
          <span className="truncate">{name}</span>
          {kinds.get(name) === 'current' && (
            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-500">Current</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className={clsx('font-semibold tabular-nums', balance < 0 ? 'text-danger' : 'text-slate-900')}>{format(balance)}</span>
          <ChevronRight size={15} className="text-slate-400" aria-hidden="true" />
        </span>
      </div>
      {(cardsByAccount.get(name) ?? []).map((card) => (
        <p key={card.id} className="flex items-center gap-1.5 pl-[23px] text-helper text-slate-500">
          <DebitCardIcon size={12} className="shrink-0 text-slate-400" />
          <span className="truncate">
            {card.last4 ? `Debit ••${card.last4}` : card.name} · {format(monthSpend.get(card.id) ?? 0)} this month
          </span>
        </p>
      ))}
      </Link>
    </li>
  )

  const empty = bankRows.length === 0 && cashRows.length === 0 && cardRows.length === 0

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Account balances</h3>
        <p className="text-helper text-slate-500">
          Each account's starting balance (set in Settings) plus your logged transactions -- not a live bank balance.
        </p>
      </div>
      {empty ? (
        <EmptyState
          icon={Wallet}
          title="No account activity yet"
          description="Log a transaction against an account to see its running balance here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {bankRows.length > 0 && (
            <Section title="Savings & current">{bankRows.map((r) => balanceRow(r.name, r.balance))}</Section>
          )}
          {cardRows.length > 0 && (
            <Section title="Credit cards">
              {cardRows.map(({ name, status }) => (
                <li key={name}>
                  <Link
                    to={cardPagePath(name)}
                    className="-mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-slate-50"
                  >
                    {/* Name with "% used" above the bar (coloured like the bar,
                        same thresholds as the Credit cards card); under the
                        bar, available / due on the left and owed on the right. */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-slate-700">
                        <AccountKindIcon kind="credit_card" size={15} className="shrink-0 text-slate-400" />
                        <span className="truncate">{name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {status.utilization !== null && (
                          <span className={clsx('text-helper font-semibold tabular-nums', UTILIZATION_TEXT[utilizationTone(status.utilization)])}>
                            {Math.round(status.utilization)}% used
                          </span>
                        )}
                        <ChevronRight size={15} className="text-slate-400" aria-hidden="true" />
                      </span>
                    </div>
                    {status.utilization !== null && (
                      <ProgressBar percent={status.utilization} tone={utilizationTone(status.utilization)} />
                    )}
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-helper text-slate-500">
                        {status.available !== null ? `${format(status.available)} available` : 'Add a credit limit in Settings to see what’s available'}
                        {status.bill && status.bill.due > 0 ? ` · ${format(status.bill.due)} due ${formatShortDate(status.bill.dueDate)}` : ''}
                      </p>
                      <span className={clsx('shrink-0 font-semibold tabular-nums', status.owed > 0 ? 'text-danger' : 'text-slate-900')}>
                        {status.owed > 0 ? `${format(status.owed)} owed` : status.credit > 0 ? `${format(status.credit)} credit` : 'Nothing owed'}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </Section>
          )}
          {cashRows.length > 0 && (
            <Section title="Cash & wallets">{cashRows.map((r) => balanceRow(r.name, r.balance))}</Section>
          )}
        </div>
      )}
    </Card>
  )
}
