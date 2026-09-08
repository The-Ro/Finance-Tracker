import { useMemo, useState, type ReactNode } from 'react'
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
import { useMyTransactions, useEveryoneTransactions } from '@/hooks/useTransactions'
import { useProfiles } from '@/hooks/useProfiles'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { PeriodSelector } from '@/components/ui/PeriodSelector'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { SortableSummaryCard } from '@/components/dashboard/SortableSummaryCard'
import { CashFlowChart } from '@/components/dashboard/CashFlowChart'
import { CategoryDonut } from '@/components/dashboard/CategoryDonut'
import { AccountBarChart } from '@/components/dashboard/AccountBarChart'
import { AccountBalances } from '@/components/dashboard/AccountBalances'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { ComingUpCard } from '@/components/dashboard/ComingUpCard'
import { CustomizeDashboardModal } from '@/components/dashboard/CustomizeDashboardModal'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { resolvePeriod, resolvePriorPeriod, isWithinRange } from '@/lib/period'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import {
  DEFAULT_DASHBOARD_ORDER,
  DEFAULT_SUMMARY_CARD_ORDER,
  SUMMARY_CARD_LABELS,
  type DashboardSectionId,
  type SummaryCardId,
} from '@/lib/dashboardSections'
import { Link } from 'react-router-dom'

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-10 w-36 rounded-lg" />
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
  const { userId } = useAuth()
  const settings = useUserSettings()
  const { format } = useFormatCurrency()
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const myTransactions = useMyTransactions(userId)
  const everyoneTransactions = useEveryoneTransactions()
  const profiles = useProfiles()

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

  const recurringItemsQuery = useQuery({
    queryKey: ['recurring_items', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('recurring_items').select('*').eq('owner_user_id', userId!)
      if (error) throw error
      return data
    },
  })

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

  if (settings.isLoading || myTransactions.isLoading) return <DashboardSkeleton />

  const order = settings.data?.dashboardOrder ?? DEFAULT_DASHBOARD_ORDER
  const hidden = settings.data?.dashboardHidden ?? []
  const summaryCardOrder = settings.data?.summaryCardOrder ?? DEFAULT_SUMMARY_CARD_ORDER
  const summaryCardHidden = settings.data?.summaryCardHidden ?? []
  const visibleSummaryCardOrder = summaryCardOrder.filter((id) => !summaryCardHidden.includes(id))

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
        label="Net worth"
        value={settings.data?.netWorthConfigured ? format(netWorth ?? 0) : 'Not set'}
        numericValue={settings.data?.netWorthConfigured ? (netWorth ?? 0) : undefined}
        format={format}
        footer={
          settings.data?.netWorthConfigured ? (
            <>
              Assets minus liabilities ·{' '}
              <Link to="/settings#net-worth" className="font-medium text-accent hover:underline">
                Edit
              </Link>
            </>
          ) : (
            <>
              Add your assets and liabilities in{' '}
              <Link to="/settings#net-worth" className="font-medium text-accent hover:underline">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleSummaryCardOrder.map((id) => (
              <SortableSummaryCard key={id} id={id} label={SUMMARY_CARD_LABELS[id]}>
                {summaryCards[id]}
              </SortableSummaryCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    ),
    // Cash flow is an independent trailing-months trend, not tied to the
    // period filter above -- otherwise "This month" would only ever have
    // one point to plot.
    cashflow: <CashFlowChart transactions={myTransactions.data ?? []} />,
    // Category and account breakdowns are separately reorderable/hideable --
    // each rendered full-width (rather than paired in a 2-col grid) since
    // Customize can now put something else between them.
    categoryChart: <CategoryDonut transactions={inPeriod} income={income} />,
    accountChart: <AccountBarChart transactions={inPeriod} />,
    accountBalances: <AccountBalances />,
    activity: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
        <ComingUpCard items={recurringItemsQuery.data ?? []} />
      </div>
    ),
    review: (
      <Card className="flex items-center gap-3 p-4">
        <AlertCircle size={18} className="shrink-0 text-accent" />
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Home</h1>
          <button
            type="button"
            aria-label="Customize dashboard"
            onClick={() => setCustomizeOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
        <PeriodSelector value={period} onChange={(value) => settings.updatePeriod.mutate(value)} />
      </div>

      {order.filter((id) => !hidden.includes(id)).map((id) => (
        <div key={id}>{sections[id]}</div>
      ))}

      <CustomizeDashboardModal open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
    </div>
  )
}
