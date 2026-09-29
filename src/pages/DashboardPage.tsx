import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, SlidersHorizontal } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useAuth } from '@/context/AuthContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useMyTransactions, useEveryoneTransactions, useAccountBalances } from '@/hooks/useTransactions'
import { useProfiles } from '@/hooks/useProfiles'
import { useRecurringItemsRaw } from '@/hooks/useRecurring'
import { useBudgets } from '@/hooks/useBudgets'
import { useAccountKinds, useCardStatuses } from '@/hooks/useCards'
import { PeriodSelector } from '@/components/ui/PeriodSelector'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { SortableSummaryCard } from '@/components/dashboard/SortableSummaryCard'
import { SavingsFlowCard } from '@/components/dashboard/SavingsFlowCard'
import { CreditCardsCard } from '@/components/dashboard/CreditCardsCard'
import { CategoryDonut } from '@/components/dashboard/CategoryDonut'
import { AccountBarChart } from '@/components/dashboard/AccountBarChart'
import { AccountBalances } from '@/components/dashboard/AccountBalances'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { ComingUpCard } from '@/components/dashboard/ComingUpCard'
import { HomeTiles } from '@/components/dashboard/HomeTiles'
import { SetupChecklist } from '@/components/setup/SetupChecklist'
import { SalaryPrompt } from '@/components/setup/SalaryPrompt'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { MonthSpendingCard } from '@/components/dashboard/MonthSpendingCard'
import { CustomizeDashboardModal } from '@/components/dashboard/CustomizeDashboardModal'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { resolvePeriod, resolvePriorPeriod, isWithinRange, PERIOD_OPTIONS } from '@/lib/period'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { firstName, greetingFor } from '@/lib/home'
import { monthlySavings, savingsHeadline } from '@/lib/savings'
import { todayISO } from '@/lib/format'
import {
  DEFAULT_DASHBOARD_ORDER,
  DEFAULT_SUMMARY_CARD_ORDER,
  SUMMARY_CARD_LABELS,
  type DashboardSectionId,
  type SummaryCardId,
} from '@/lib/dashboardSections'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

const DESKTOP_QUERY = '(min-width: 1024px)'

/** True at Tailwind's lg breakpoint and up; follows window resizes. */
function useIsDesktop(): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const onChange = () => setMatches(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return matches
}

/** Sections shown side by side from lg up when both are visible (user request). */
const SIDE_BY_SIDE: [DashboardSectionId, DashboardSectionId] = ['accountChart', 'accountBalances']

/**
 * The visible sections in the user's order. Savings accounts and Account
 * balances share one row on desktop (stacked on phones), placed where the
 * first of the two sits in the order and keeping their relative order.
 */
function renderSections(visible: DashboardSectionId[], sections: Record<DashboardSectionId, ReactNode>): ReactNode[] {
  const paired = SIDE_BY_SIDE.every((id) => visible.includes(id))
  const out: ReactNode[] = []
  let pairPlaced = false
  for (const id of visible) {
    if (!paired || !SIDE_BY_SIDE.includes(id)) {
      out.push(<div key={id}>{sections[id]}</div>)
      continue
    }
    if (pairPlaced) continue
    pairPlaced = true
    const pair = visible.filter((v) => SIDE_BY_SIDE.includes(v))
    out.push(
      <div key="accounts-pair" className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {pair.map((p) => (
          <div key={p} className="min-w-0">
            {sections[p]}
          </div>
        ))}
      </div>
    )
  }
  return out
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-7 w-56" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className={clsx('flex flex-col gap-2 p-4 sm:p-5', i === 2 && 'col-span-2 lg:col-span-1')}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-40" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="flex flex-col gap-3 p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-48 w-full" />
      </Card>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <Skeleton className="h-48 w-full" />
        </Card>
        <Card className="p-5">
          <Skeleton className="h-48 w-full" />
        </Card>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { userId, displayName } = useAuth()
  const settings = useUserSettings()
  const { format } = useFormatCurrency()
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const myTransactions = useMyTransactions(userId)
  const everyoneTransactions = useEveryoneTransactions()
  const profiles = useProfiles()
  const balances = useAccountBalances(userId)
  const cardStatuses = useCardStatuses()
  // The budget list inside "<Month> spending" is desktop-only, as before.
  const isDesktop = useIsDesktop()
  const budgets = useBudgets()
  const recurringItems = useRecurringItemsRaw()

  // Lets the 4 summary cards be reordered by dragging them right here on
  // Home, not just via the nested list in the Customize modal. Hooks, so
  // this has to sit above the loading-state early return below.
  //
  // The whole card is the drag surface (SortableSummaryCard), not just a
  // small grip handle -- MouseSensor's small activation distance keeps
  // desktop dragging snappy, while TouchSensor's press-and-hold delay is
  // what lets a normal scroll-swipe starting on a card pass through to the
  // browser untouched instead of being captured as a drag attempt; only a
  // finger that stays put past the delay commits to a drag.
  const summaryCardSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const period = settings.data?.selectedPeriod ?? 'all-time'
  const range = useMemo(() => resolvePeriod(period), [period])
  const priorRange = useMemo(() => resolvePriorPeriod(period), [period])

  const inPeriod = useMemo(
    () => (myTransactions.data ?? []).filter((t) => isWithinRange(t.date, range)),
    [myTransactions.data, range]
  )
  const inPriorPeriod = useMemo(
    () => (priorRange ? (myTransactions.data ?? []).filter((t) => isWithinRange(t.date, priorRange)) : []),
    [myTransactions.data, priorRange]
  )

  const income = inPeriod.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const spending = inPeriod.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const savingsRate = income === 0 ? 0 : ((income - spending) / income) * 100

  const priorIncome = inPriorPeriod.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const priorSpending = inPriorPeriod.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const hasPriorData = inPriorPeriod.length > 0

  const netWorth = settings.data ? settings.data.assetsTotal - settings.data.liabilitiesTotal : null

  const needsReviewCount = inPeriod.filter((t) => t.type !== 'transfer' && t.category === 'Needs review').length

  const everyoneRecent = everyoneTransactions.data ?? []

  // Savings flow + "Saved this month": the user's own last six calendar
  // months (local dates), independent of the period filter -- otherwise
  // "This month" would only ever have one point to plot. Card spends count
  // when the bill is paid (see monthlySavings), so it needs the card names.
  const kinds = useAccountKinds()
  const cardAccounts = useMemo(
    () => new Set([...kinds].filter(([, kind]) => kind === 'credit_card').map(([name]) => name)),
    [kinds]
  )
  const savingsRows = useMemo(
    () => monthlySavings(myTransactions.data ?? [], todayISO(), 6, cardAccounts),
    [myTransactions.data, cardAccounts]
  )
  const savedThisMonth = useMemo(() => savingsHeadline(savingsRows), [savingsRows])

  if (settings.isLoading || myTransactions.isLoading) return <DashboardSkeleton />

  const order = settings.data?.dashboardOrder ?? DEFAULT_DASHBOARD_ORDER
  const hidden = settings.data?.dashboardHidden ?? []
  const summaryCardOrder = settings.data?.summaryCardOrder ?? DEFAULT_SUMMARY_CARD_ORDER
  const summaryCardHidden = settings.data?.summaryCardHidden ?? []
  const visibleSummaryCardOrder = summaryCardOrder.filter((id) => !summaryCardHidden.includes(id))

  const myList = myTransactions.data ?? []
  // Budgets and what's due this week sit side by side under the tiles (stacked
  // on phones). MonthSpendingCard renders nothing without an active budget;
  // let Due this week take the full row then.
  const hasBudgets = (budgets.data ?? []).some((b) => b.active && b.monthly_limit > 0)
  const hasCards = cardStatuses.size > 0

  const now = new Date()
  const name = firstName(displayName)
  const greeting = `${greetingFor(now.getHours())}${name ? `, ${name}` : ''}`
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  const handleSummaryCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = summaryCardOrder.indexOf(active.id as SummaryCardId)
    const newIndex = summaryCardOrder.indexOf(over.id as SummaryCardId)
    if (oldIndex === -1 || newIndex === -1) return
    settings.updateDashboardLayout.mutate({ summaryCardOrder: arrayMove(summaryCardOrder, oldIndex, newIndex) })
  }

  // The four summary cards are reorderable among themselves too (nested
  // under "Summary cards" in Customize) -- same "build once, look up by id"
  // pattern as the top-level sections below.
  const summaryCards: Record<SummaryCardId, ReactNode> = {
    netWorth: (
      <SummaryCard
        key="netWorth"
        highlight
        label="Net worth"
        value={settings.data?.netWorthConfigured ? format(netWorth ?? 0) : 'Not set'}
        numericValue={settings.data?.netWorthConfigured ? (netWorth ?? 0) : undefined}
        format={format}
        footer={
          settings.data?.netWorthConfigured ? (
            <>
              Assets minus liabilities ·{' '}
              <Link to="/settings/net-worth" className="font-medium text-accent-dark hover:underline">
                Edit
              </Link>
            </>
          ) : (
            <>
              Add your assets and liabilities in{' '}
              <Link to="/settings/net-worth" className="font-medium text-accent-dark hover:underline">
                Settings
              </Link>
              .
            </>
          )
        }
      />
    ),
    income: (
      <SummaryCard
        key="income"
        label="Income"
        value={format(income)}
        numericValue={income}
        format={format}
        valueClassName="text-positive"
        footer={hasPriorData ? `${format(priorIncome)} last period` : 'No trend yet'}
      />
    ),
    spending: (
      <SummaryCard
        key="spending"
        label="Spending"
        value={format(spending)}
        numericValue={spending}
        format={format}
        footer={hasPriorData ? `${format(priorSpending)} last period` : 'No trend yet'}
      />
    ),
    savingsRate: (
      <SummaryCard
        key="savingsRate"
        label="Savings rate"
        value={`${savingsRate.toFixed(0)}%`}
        numericValue={savingsRate}
        format={(n) => `${n.toFixed(0)}%`}
        footer={income === 0 ? 'Add income to calculate' : `${format(income - spending)} saved`}
      />
    ),
  }

  // Built once the loading gate above has passed, so every section here can
  // freely use `settings.data`/`myTransactions.data` without its own null
  // check -- `order`/`hidden` (user-configurable via Settings > Dashboard
  // layout) decide which of these actually render, and in what sequence.
  const sections: Record<DashboardSectionId, ReactNode> = {
    summary: (
      <DndContext sensors={summaryCardSensors} collisionDetection={closestCenter} onDragEnd={handleSummaryCardDragEnd}>
        <SortableContext items={visibleSummaryCardOrder} strategy={rectSortingStrategy}>
          {/* Two tiles a row on phones too; an odd one out spans the row. */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 [&>*:last-child:nth-child(odd)]:col-span-2 xl:[&>*:last-child:nth-child(odd)]:col-span-1">
            {visibleSummaryCardOrder.map((id) => (
              <SortableSummaryCard key={id} id={id} label={SUMMARY_CARD_LABELS[id]}>
                {summaryCards[id]}
              </SortableSummaryCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    ),
    // Savings flow (the old cash-flow slot, same Customize id) with the
    // Credit cards card beside it on desktop; full width without cards.
    cashflow: (
      <div className={clsx('grid grid-cols-1 gap-4', hasCards && 'lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]')}>
        <SavingsFlowCard rows={savingsRows} />
        <CreditCardsCard />
      </div>
    ),
    // Category and account breakdowns are separately reorderable/hideable --
    // each rendered full-width (rather than paired in a 2-col grid) since
    // Customize can now put something else between them.
    categoryChart: <CategoryDonut transactions={inPeriod} income={income} />,
    accountChart: (
      <AccountBarChart
        transactions={myTransactions.data ?? []}
        range={range}
        periodLabel={PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? 'This period'}
      />
    ),
    accountBalances: <AccountBalances />,
    activity: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivity
          title="Recent activity"
          transactions={inPeriod}
          emptyDescription="Your recent transactions will show up here."
        />
        <RecentActivity
          title="Everyone's recent activity"
          transactions={everyoneRecent}
          showOwner
          profiles={profiles.data}
          emptyDescription="Nothing logged by anyone yet."
        />
      </div>
    ),
    review: (
      <Card className="flex items-center gap-3 p-4">
        <AlertCircle size={18} className="shrink-0 text-accent-dark" />
        <p className="text-sm text-slate-600">
          {needsReviewCount === 0
            ? 'Nothing needs review right now.'
            : `${needsReviewCount} transaction${needsReviewCount === 1 ? '' : 's'} in this period still need a category.`}
        </p>
      </Card>
    ),
  }

  return (
    <div className="flex flex-col gap-6">
      {/* The date (with the chosen period after it) gets the full width; the
          greeting shares its line with two small icons -- the period filter and
          Customize -- so nothing crowds or hides the date. */}
      <div className="animate-fade-in-up flex flex-col gap-1">
        <p className="truncate text-sm text-slate-500">
          {dateLabel} · {PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? 'All time'}
        </p>
        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 font-serif text-2xl font-semibold text-slate-900">{greeting}</h1>
          <div className="-mr-2 flex shrink-0 items-center">
            <PeriodSelector iconOnly value={period} onChange={(value) => settings.updatePeriod.mutate(value)} />
            <button
              type="button"
              aria-label="Customize dashboard"
              onClick={() => setCustomizeOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </div>
      </div>

      <HomeTiles balances={balances} saved={savedThisMonth} />

      {/* New users: what's left after the welcome wizard (hides itself when done or dismissed). */}
      {/* Payday: "did your salary arrive?" (Settings -> Salary). */}
      <SalaryPrompt />
      <SetupChecklist />

      <div className="stagger-rows flex flex-col gap-4">
        <QuickActions />
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <MonthSpendingCard budgets={budgets.data ?? []} transactions={myList} showBudgets={isDesktop} />
          <ComingUpCard items={recurringItems.data ?? []} className={clsx(!hasBudgets && 'sm:col-span-2')} />
        </div>
      </div>

      {renderSections(order.filter((id) => !hidden.includes(id)), sections)}

      <CustomizeDashboardModal open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
    </div>
  )
}
