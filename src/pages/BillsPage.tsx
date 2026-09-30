import { useMemo, useRef, useState, type TouchEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, CreditCard, ListFilter } from 'lucide-react'
import clsx from 'clsx'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Dropdown } from '@/components/ui/Dropdown'
import { useRecurringItemsRaw, useRecurringMutations, type RecurringItem } from '@/hooks/useRecurring'
import { useAccountBalances } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAuth } from '@/context/AuthContext'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { useAccountKinds, useCardBills } from '@/hooks/useCards'
import { addDaysISO, dueDatesInRange, monthGrid, totalDueWithin } from '@/lib/billCalendar'
import { formatShortDate, todayISO } from '@/lib/format'
import { cardPagePath } from '@/components/cards/cardPath'
import { RecurringFormModal } from '@/components/recurring/RecurringFormModal'
import { BillsCardsSection } from '@/components/cards/BillsCardsSection'
import { MoneyReminders } from '@/components/bills/MoneyReminders'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** How far ahead "Coming up" and the total look. */
const WINDOW_OPTIONS = [7, 14, 30] as const
type WindowDays = (typeof WINDOW_OPTIONS)[number]
const windowLabel = (days: number) => `Next ${days} days`

/** A horizontal swipe at least this long (px) on the calendar changes the month. */
const SWIPE_MIN_PX = 50

/**
 * Bill calendar: every active recurring item and subscription projected onto a
 * month grid, plus what's due in the next 7 days and whether each account can
 * cover it. Read-only projection -- "Mark paid" (the existing RPC) is still the
 * only thing that moves an item's next_date.
 */
export function BillsPage() {
  const { userId } = useAuth()
  const { format } = useFormatCurrency()
  const { data: items = [], isLoading } = useRecurringItemsRaw()
  const { markPaid } = useRecurringMutations()
  const balances = useAccountBalances(userId)
  const kinds = useAccountKinds()
  // Credit-card bills (statement amount still unpaid) sit alongside recurring
  // items: on the calendar at their due date and in Coming up with "Pay bill".
  const cardBills = useCardBills()
  const { openAddEntry } = useGlobalModals()
  const today = todayISO()
  const [month, setMonth] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return { year: y, index: m - 1 }
  })
  const [selected, setSelected] = useState(today)
  const [windowDays, setWindowDays] = useState<WindowDays>(7)
  const [editing, setEditing] = useState<RecurringItem | null>(null)
  // Which way the month grid slides in: 1 = next month (from the right), -1 = previous.
  const [slide, setSlide] = useState<1 | -1 | 0>(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const active = useMemo(() => items.filter((i) => i.active), [items])
  const grid = monthGrid(month.year, month.index)
  const monthStart = grid.days[0]
  const monthEnd = grid.days[grid.days.length - 1]

  const byDate = useMemo(() => {
    const map = new Map<string, { id: string; name: string; amount: number }[]>()
    for (const item of active) {
      for (const d of dueDatesInRange(item, monthStart, monthEnd)) map.set(d, [...(map.get(d) ?? []), item])
    }
    for (const b of cardBills) {
      if (b.dueDate >= monthStart && b.dueDate <= monthEnd) {
        map.set(b.dueDate, [...(map.get(b.dueDate) ?? []), { id: 'card:' + b.account, name: b.account + ' bill', amount: b.due }])
      }
    }
    return map
  }, [active, cardBills, monthStart, monthEnd])

  const weekEnd = addDaysISO(today, windowDays - 1)
  const dueSoon = useMemo(() => {
    const rows: { item: RecurringItem; date: string }[] = []
    for (const item of active) {
      if (item.next_date < today) rows.push({ item, date: item.next_date })
      for (const d of dueDatesInRange(item, today, weekEnd)) rows.push({ item, date: d })
    }
    return rows.sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [active, today, weekEnd])
  // Card bills due within the week (or already overdue) count toward the total.
  const cardDueSoon = cardBills.filter((b) => b.dueDate <= weekEnd)
  // Something charged to a credit card (a card EMI, a subscription on the card)
  // is paid through that card's bill, so it isn't counted again on its own.
  const onCard = (item: RecurringItem) => !!item.account && kinds.get(item.account) === 'credit_card'
  const weekTotal =
    totalDueWithin(active.filter((i) => !onCard(i)), today, windowDays) + cardDueSoon.reduce((sum, b) => sum + b.due, 0)

  // Per-account: can the current balance cover everything due this week from it?
  const shortfalls = useMemo(() => {
    const need = new Map<string, number>()
    // Credit cards aren't funded accounts -- spending on one can't be "short".
    for (const { item } of dueSoon) if (item.account && kinds.get(item.account) !== 'credit_card') need.set(item.account, (need.get(item.account) ?? 0) + item.amount)
    return [...need.entries()].filter(([account, amount]) => (balances.get(account) ?? 0) < amount).map(([a]) => a)
  }, [dueSoon, balances, kinds])

  const selectedItems = selected >= monthStart && selected <= monthEnd ? byDate.get(selected) ?? [] : []
  const shiftMonth = (delta: 1 | -1) => {
    setSlide(delta)
    setMonth(({ year, index }) => {
      const n = index + delta
      return { year: year + Math.floor(n / 12), index: ((n % 12) + 12) % 12 }
    })
  }
  // Swipe the calendar sideways to change month; a mostly-vertical move is a
  // page scroll and is left alone.
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1)
  }
  const monthLabel = new Date(month.year, month.index, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  if (!isLoading && active.length === 0 && cardBills.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Bills" />
        <EmptyState
          icon={CalendarDays}
          title="No bills to show yet"
          description="Confirm a recurring payment or subscription and its due dates will appear on this calendar."
          action={
            <Link to="/recurring" className="text-helper font-medium text-accent-dark hover:underline">
              Go to Recurring
            </Link>
          }
        />
        {/* Cards and money reminders still show without recurring bills. */}
        <BillsCardsSection />
        <MoneyReminders />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Bills"
        actions={
          <Dropdown
            compact
            icon={ListFilter}
            aria-label="How far ahead to look"
            options={WINDOW_OPTIONS.map(windowLabel)}
            value={windowLabel(windowDays)}
            onChange={(e) => {
              const days = WINDOW_OPTIONS.find((d) => windowLabel(d) === e.target.value)
              if (days) setWindowDays(days)
            }}
          />
        }
      />

      <Card className="animate-fade-in-up flex flex-wrap items-center justify-between gap-3 border-brass/30 bg-brass-light p-5">
        <div>
          <p className="text-helper font-semibold uppercase tracking-wide text-slate-600">{windowLabel(windowDays)}</p>
          <p className="font-serif text-3xl font-semibold text-slate-900">{format(weekTotal)} due</p>
        </div>
        <p className="text-sm text-slate-700">
          {dueSoon.length === 0 && cardDueSoon.length === 0
            ? `Nothing due in the next ${windowDays} days.`
            : shortfalls.length === 0
              ? 'Your accounts cover everything due.'
              : `Not enough in ${shortfalls.join(', ')} to cover what's due.`}
        </p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="animate-fade-in-up p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-slate-900">{monthLabel}</h2>
            <div className="flex gap-1">
              <button
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          {/* Swipe left/right anywhere on the grid for the next/previous month. */}
          <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="touch-pan-y select-none overflow-hidden">
          <div
            key={`${month.year}-${month.index}`}
            className={clsx(slide === 1 && 'animate-slide-in-right', slide === -1 && 'animate-slide-in-left')}
          >
          <div className="grid grid-cols-7 gap-1 text-center text-helper font-semibold text-slate-400">
            {WEEKDAYS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: grid.leading }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {grid.days.map((date) => {
              const due = byDate.get(date)
              const isSelected = date === selected
              return (
                <button
                  key={date}
                  onClick={() => setSelected(date)}
                  aria-pressed={isSelected}
                  aria-label={`${formatShortDate(date)}${due ? `, ${due.length} due` : ''}`}
                  className={clsx(
                    'flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition-colors',
                    isSelected
                      ? 'bg-accent font-semibold text-white'
                      : due
                        ? 'font-semibold text-slate-900 hover:bg-slate-100'
                        : 'text-slate-400 hover:bg-slate-100',
                    date === today && !isSelected && 'ring-1 ring-accent'
                  )}
                >
                  {Number(date.slice(8))}
                  <span className={clsx('h-1.5 w-1.5 rounded-full', due ? (isSelected ? 'bg-white' : 'bg-brass') : 'bg-transparent')} />
                </button>
              )
            })}
          </div>
          </div>
          </div>
          {selectedItems.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 border-t border-app-border pt-3 text-sm">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span className="text-slate-700">{item.name}</span>
                  <span className="tabular-nums text-slate-900">{format(item.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="animate-fade-in-up p-4">
          <h2 className="mb-3 font-serif text-lg font-semibold text-slate-900">Coming up</h2>
          {cardDueSoon.length > 0 && (
            <ul className="mb-2 flex flex-col gap-2">
              {cardDueSoon.map((b) => (
                <li key={b.account} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <Link
                    to={cardPagePath(b.account)}
                    aria-label={`Open ${b.account}`}
                    className="-m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 hover:bg-slate-100"
                  >
                  <div className="w-12 text-center">
                    <p className={clsx('text-[11px] font-bold uppercase', b.dueDate < today ? 'text-danger' : 'text-slate-500')}>
                      {b.dueDate < today ? 'Overdue' : new Date(b.dueDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
                    </p>
                    <p className="font-serif text-lg font-semibold text-slate-900">{Number(b.dueDate.slice(8))}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900">
                      <CreditCard size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="truncate">{b.account} bill</span>
                    </p>
                    <p className="text-helper text-slate-500">
                      {format(b.due)} · bill of {formatShortDate(b.statementDate)}
                    </p>
                  </div>
                  </Link>
                  <Button
                    variant="secondary"
                    onClick={() => openAddEntry('transfer', { toAccount: b.account, amount: b.due, merchant: b.account + ' bill payment' })}
                  >
                    Pay bill
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {dueSoon.length === 0 ? (
            cardDueSoon.length === 0 && <p className="text-sm text-slate-500">Nothing due in the next {windowDays} days.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dueSoon.map(({ item, date }) => {
                const overdue = date < today
                // Only the item's actual next_date can be marked paid (that's what the RPC advances).
                const payable = date === item.next_date && date <= today
                return (
                  <li key={`${item.id}-${date}`} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      aria-label={`Open ${item.name}`}
                      className="-m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left hover:bg-slate-100"
                    >
                    <div className="w-12 text-center">
                      <p className={clsx('text-[11px] font-bold uppercase', overdue ? 'text-danger' : 'text-slate-500')}>
                        {overdue ? 'Overdue' : new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
                      </p>
                      <p className="font-serif text-lg font-semibold text-slate-900">{Number(date.slice(8))}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-helper text-slate-500">
                        {format(item.amount)}
                        {item.account ? (onCard(item) ? ` · goes on the ${item.account} bill` : ` · ${item.account}`) : ''}
                      </p>
                    </div>
                    </button>
                    {payable && item.account && (
                      <Button variant="secondary" onClick={() => markPaid.mutate(item)} disabled={markPaid.isPending}>
                        Mark paid
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
      <BillsCardsSection />
      <MoneyReminders />
      {/* Tapping a Coming up row opens it here to check or change it. */}
      <RecurringFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        kind={editing?.kind ?? 'recurring'}
        editing={editing}
      />
    </div>
  )
}
