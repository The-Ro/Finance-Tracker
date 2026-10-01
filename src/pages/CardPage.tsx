import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronLeft, CreditCard } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { CardPaymentNotice } from '@/components/cards/CardPaymentNotice'
import { useAuth } from '@/context/AuthContext'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { useCardDetail } from '@/hooks/useCards'
import { useRecurringItemsRaw } from '@/hooks/useRecurring'
import { loanDetailsOf, loanMonthLabel, loanProgress, outstandingPrincipal } from '@/lib/loans'
import { useAccountDetails } from '@/hooks/useLookupLists'
import { useCardPaymentSuggestions } from '@/hooks/useCardPaymentSuggestions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import type { Transaction } from '@/hooks/useTransactions'
import { daysUntil, lastStatementDate, nextStatementDate, type StatementStatus } from '@/lib/creditCards'
import { formatShortDate, todayISO } from '@/lib/format'

const UNBILLED_ROWS = 8
const ACTIVITY_ROWS = 15

const STATUS_STYLES: Record<StatementStatus, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-positive-light text-positive' },
  upcoming: { label: 'Due', className: 'bg-brass-light text-brass' },
  'partly paid': { label: 'Partly paid', className: 'bg-caution-light text-caution' },
  unpaid: { label: 'Unpaid', className: 'bg-danger-light text-danger' },
}

function StatusPill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={clsx('shrink-0 rounded-full px-2.5 py-0.5 text-helper font-semibold', className)}>{children}</span>
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-helper text-slate-500">{label}</span>
      <span className="truncate text-sm font-semibold tabular-nums text-slate-900">{value}</span>
    </div>
  )
}

/** How a transaction moved this card, from the card's side: spends owe more, payments and refunds owe less. */
function cardEffect(t: Transaction, account: string): { amount: number; label: string } {
  if (t.type === 'expense') return { amount: -t.amount, label: t.category ?? 'Spend' }
  if (t.type === 'transfer' && t.to_account === account) return { amount: t.amount, label: `Payment from ${t.account}` }
  if (t.type === 'transfer') return { amount: -t.amount, label: `Transfer to ${t.to_account}` }
  return { amount: t.amount, label: t.category ?? 'Refund' }
}

/**
 * One credit card: what's owed and available, the current bill with Pay bill,
 * spending not billed yet, past statements and recent activity.
 */
export function CardPage() {
  const { account = '' } = useParams()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const detail = useCardDetail(account)
  const { data: detailsMap, isLoading } = useAccountDetails()
  const { openAddEntry, openEditEntry } = useGlobalModals()
  const { format, formatSigned } = useFormatCurrency()
  const cardPayments = useCardPaymentSuggestions()
  const [showAllUnbilled, setShowAllUnbilled] = useState(false)
  // EMIs charged to this card (recurring loan items on it).
  const { data: recurring = [] } = useRecurringItemsRaw()
  const emis = useMemo(
    () =>
      recurring
        .filter((r) => r.active && r.account === account && loanDetailsOf(r))
        .map((r) => {
          const loan = loanDetailsOf(r)!
          return {
            item: r,
            progress: loanProgress(loan, Number(r.amount), r.cadence, r.next_date),
            held: outstandingPrincipal(loan, Number(r.amount), r.cadence, r.next_date),
          }
        }),
    [recurring, account]
  )
  const today = todayISO()

  const suggestions = useMemo(
    () => cardPayments.suggestions.filter((s) => s.card === account),
    [cardPayments.suggestions, account]
  )

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/')
  }

  const header = (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={goBack}
        className="-ml-2 flex min-h-[44px] w-fit items-center gap-1 px-2 text-sm font-medium text-accent-dark hover:underline"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        Back
      </button>
      <h1 className="flex min-w-0 items-center gap-2 font-serif text-2xl font-semibold text-slate-900">
        <CreditCard size={22} className="shrink-0 text-slate-400" aria-hidden="true" />
        <span className="truncate">{account}</span>
      </h1>
    </div>
  )

  if (!detail) {
    const known = detailsMap?.get(account)
    const loading = isLoading || (!detailsMap && !!userId) || (known?.kind === 'credit_card')
    return (
      <div className="flex flex-col gap-4">
        {header}
        {loading ? (
          <Card className="flex flex-col gap-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-2 w-full" />
          </Card>
        ) : (
          <Card className="p-5">
            <EmptyState
              icon={CreditCard}
              title="Not a credit card"
              description={
                known
                  ? `${account} isn't marked as a credit card. Change its type in Settings, Accounts & cards.`
                  : "This card doesn't exist any more."
              }
              action={
                <Link to="/settings/accounts" className="text-helper font-medium text-accent-dark hover:underline">
                  Accounts & cards
                </Link>
              }
            />
          </Card>
        )}
      </div>
    )
  }

  const { details, status, history, unbilled, transactions } = detail
  const bill = status.bill
  const billDays = bill ? daysUntil(bill.dueDate, today) : 0
  const payBill = () =>
    openAddEntry('transfer', {
      toAccount: account,
      amount: bill?.due || undefined,
      merchant: account + ' bill payment',
      account: detailsMap?.get(account)?.payFrom ?? undefined,
    })
  const unbilledShown = unbilled ? (showAllUnbilled ? unbilled.transactions : unbilled.transactions.slice(0, UNBILLED_ROWS)) : []

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Card className="animate-fade-in-up flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-helper font-semibold uppercase tracking-wide text-slate-500">
              {status.credit > 0 ? 'In credit' : 'Owed now'}
            </p>
            <p
              className={clsx(
                'font-serif text-3xl font-semibold tabular-nums sm:text-4xl',
                status.owed > 0 ? 'text-danger' : status.credit > 0 ? 'text-positive' : 'text-slate-900'
              )}
            >
              {format(status.credit > 0 ? status.credit : status.owed)}
            </p>
          </div>
          {status.owed > 0 && (
            <Button variant="secondary" onClick={payBill} className="shrink-0">
              Pay card
            </Button>
          )}
        </div>
        {status.utilization !== null && details.creditLimit !== null ? (
          <div className="flex flex-col gap-1.5">
            <ProgressBar
              percent={status.utilization}
              tone={status.utilization > 80 ? 'danger' : status.utilization > 50 ? 'caution' : 'positive'}
            />
            <p className="text-helper text-slate-500">
              {format(status.available ?? 0)} available of {format(details.creditLimit)} · {Math.round(status.utilization)}% used
            </p>
            {status.emiLocked > 0 && (
              <p className="text-helper text-slate-500">
                {format(status.emiLocked)} is held for EMIs on this card: the loan still to repay. It frees up as you pay the EMIs.
              </p>
            )}
          </div>
        ) : (
          <Link to="/settings/accounts" className="text-helper font-medium text-accent-dark hover:underline">
            Add a credit limit to see what's available
          </Link>
        )}
      </Card>

      {/* In credit: almost always a payment logged without the charge it paid
          (often an EMI on the statement). Offer to add that charge. */}
      {status.credit > 0 && (
        <Card className="flex flex-col gap-3 border-caution/40 p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">This card shows {format(status.credit)} in credit</h2>
            <p className="mt-1 text-helper text-slate-500">
              That usually means a payment was logged, but what it paid for wasn’t, often an EMI on the statement. Add the
              missing charge, or update what you owe.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {emis.map(({ item }) => (
              <Button
                key={item.id}
                variant="secondary"
                onClick={() =>
                  openAddEntry('expense', {
                    merchant: item.name,
                    amount: Number(item.amount),
                    account,
                    date: details.statementDay ? lastStatementDate(details.statementDay, today) : today,
                    category: item.category ?? undefined,
                  })
                }
              >
                Add the {item.name} charge
              </Button>
            ))}
            <Link to="/settings/accounts" className="inline-flex min-h-[44px] items-center px-2 text-helper font-medium text-accent-dark hover:underline">
              Update what I owe
            </Link>
          </div>
        </Card>
      )}

      {emis.length > 0 && (
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">EMIs on this card</h2>
            <p className="text-helper text-slate-500">
              Each EMI goes on the bill{details.statementDay ? ` on ${formatShortDate(nextStatementDate(details.statementDay, today))}` : ''}. What’s left to repay is held from the limit.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-app-border">
            {emis.map(({ item, progress, held }) => (
              <li key={item.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-slate-900">{format(Number(item.amount))} a month</span>
                </div>
                {progress && (
                  <>
                    <ProgressBar percent={(progress.paid / progress.total) * 100} tone="positive" />
                    <span className="text-helper tabular-nums text-slate-500">
                      {progress.paid} of {progress.total} paid · ends {loanMonthLabel(progress.endMonth)}
                      {held > 0 && ` · ${format(held)} held`}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <CardPaymentNotice suggestions={suggestions} cardAccounts={cardPayments.cardAccounts} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="animate-fade-in-up flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-semibold text-slate-900">Current bill</h2>
            {bill && (
              <StatusPill
                className={
                  bill.due <= 0
                    ? STATUS_STYLES.paid.className
                    : billDays < 0
                      ? STATUS_STYLES.unpaid.className
                      : STATUS_STYLES.upcoming.className
                }
              >
                {bill.due <= 0
                  ? 'Paid'
                  : billDays < 0
                    ? `Overdue ${-billDays}d`
                    : billDays === 0
                      ? 'Due today'
                      : `Due in ${billDays} day${billDays === 1 ? '' : 's'}`}
              </StatusPill>
            )}
          </div>
          {bill ? (
            <>
              <div>
                <p className="text-helper text-slate-500">{bill.due > 0 ? 'Still to pay' : 'Nothing left to pay'}</p>
                <p className="font-serif text-2xl font-semibold tabular-nums text-slate-900">{format(bill.due)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Bill date" value={formatShortDate(bill.statementDate)} />
                <Stat label="Due" value={formatShortDate(bill.dueDate)} />
                <Stat label="Bill amount" value={format(bill.statementBalance)} />
                <Stat label="Paid so far" value={format(bill.paidSinceStatement)} />
              </div>
              {bill.due > 0 && (
                <Button onClick={payBill} className="w-full sm:w-auto sm:self-start">
                  Pay bill
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Add this card's bill day and due day in{' '}
              <Link to="/settings/accounts" className="font-medium text-accent-dark hover:underline">
                Settings, Accounts & cards
              </Link>{' '}
              to see each bill and when it's due.
            </p>
          )}
        </Card>

        {unbilled && (
          <Card className="animate-fade-in-up flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg font-semibold text-slate-900">Not on a bill yet</h2>
                <p className="text-helper text-slate-500">Since {formatShortDate(unbilled.since)} · goes on the next bill</p>
              </div>
              <span className="shrink-0 font-serif text-lg font-semibold tabular-nums text-slate-900">{format(unbilled.total)}</span>
            </div>
            {unbilled.transactions.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing spent since the last bill.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-app-border">
                {unbilledShown.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate text-slate-800">{t.merchant}</span>
                      <span className="block text-helper text-slate-500">{formatShortDate(t.date)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-900">{format(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {!showAllUnbilled && unbilled.transactions.length > UNBILLED_ROWS && (
              <button
                type="button"
                onClick={() => setShowAllUnbilled(true)}
                className="min-h-[44px] self-start text-helper font-semibold text-accent-dark hover:underline"
              >
                Show {unbilled.transactions.length - UNBILLED_ROWS} more
              </button>
            )}
          </Card>
        )}
      </div>

      {history.length > 0 && (
        <Card className="animate-fade-in-up flex flex-col gap-2 p-5">
          <h2 className="font-serif text-lg font-semibold text-slate-900">Past bills</h2>
          <ul className="flex flex-col divide-y divide-app-border">
            {history.map((s) => {
              const style = STATUS_STYLES[s.status]
              return (
                <li key={s.statementDate} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block text-slate-800">
                      Bill of {formatShortDate(s.statementDate)}
                    </span>
                    <span className="block text-helper text-slate-500">
                      Due {formatShortDate(s.dueDate)} · paid {format(s.paidByDue)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums text-slate-900">{format(s.statementBalance)}</span>
                    <StatusPill className={style.className}>{style.label}</StatusPill>
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Card className="animate-fade-in-up flex flex-col gap-2 p-5">
        <h2 className="font-serif text-lg font-semibold text-slate-900">Recent activity</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing on this card yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-app-border">
            {transactions.slice(0, ACTIVITY_ROWS).map((t) => {
              const effect = cardEffect(t, account)
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openEditEntry(t)}
                    className="-mx-2 flex min-h-[44px] w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-slate-800">{t.merchant}</span>
                      <span className="block truncate text-helper text-slate-500">
                        {formatShortDate(t.date)} · {effect.label}
                      </span>
                    </span>
                    <span
                      className={clsx(
                        'shrink-0 font-semibold tabular-nums',
                        effect.amount > 0 ? 'text-positive' : 'text-slate-900'
                      )}
                    >
                      {formatSigned(Math.abs(effect.amount), effect.amount > 0 ? 'income' : 'expense')}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
