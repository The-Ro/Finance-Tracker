import { useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useMyTransactions, useEveryoneTransactions } from '@/hooks/useTransactions'
import { useProfiles } from '@/hooks/useProfiles'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { PeriodSelector } from '@/components/ui/PeriodSelector'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { CashFlowChart } from '@/components/dashboard/CashFlowChart'
import { CategoryDonut } from '@/components/dashboard/CategoryDonut'
import { AccountBarChart } from '@/components/dashboard/AccountBarChart'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { ComingUpCard } from '@/components/dashboard/ComingUpCard'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { resolvePeriod, resolvePriorPeriod, isWithinRange } from '@/lib/period'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
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
  const myTransactions = useMyTransactions(userId)
  const everyoneTransactions = useEveryoneTransactions()
  const profiles = useProfiles()

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

  const netWorth = settings.data
    ? settings.data.assetsTotal - settings.data.liabilitiesTotal
    : null

  const needsReviewCount = inPeriod.filter((t) => t.type !== 'transfer' && t.category === 'Needs review').length

  const everyoneRecent = everyoneTransactions.data ?? []

  if (settings.isLoading || myTransactions.isLoading) return <DashboardSkeleton />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Home</h1>
        <PeriodSelector
          value={period}
          onChange={(value) => settings.updatePeriod.mutate(value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Net worth"
          value={settings.data?.netWorthConfigured ? format(netWorth ?? 0) : 'Not set'}
          numericValue={settings.data?.netWorthConfigured ? (netWorth ?? 0) : undefined}
          format={format}
          footer={
            settings.data?.netWorthConfigured ? (
              'Assets minus liabilities'
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
        <SummaryCard
          label="Income"
          value={format(income)}
          numericValue={income}
          format={format}
          valueClassName="text-positive"
          footer={hasPriorData ? `${format(priorIncome)} last period` : 'No trend yet'}
        />
        <SummaryCard
          label="Spending"
          value={format(spending)}
          numericValue={spending}
          format={format}
          footer={hasPriorData ? `${format(priorSpending)} last period` : 'No trend yet'}
        />
        <SummaryCard
          label="Savings rate"
          value={`${savingsRate.toFixed(0)}%`}
          numericValue={savingsRate}
          format={(n) => `${n.toFixed(0)}%`}
          footer={income === 0 ? 'Add income to calculate' : `${format(income - spending)} saved`}
        />
      </div>

      {/* Cash flow is an independent trailing-months trend, not tied to the
          period filter above -- otherwise "This month" would only ever
          have one point to plot. */}
      <CashFlowChart transactions={myTransactions.data ?? []} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CategoryDonut transactions={inPeriod} />
        <AccountBarChart transactions={inPeriod} />
      </div>

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

      <Card className="flex items-center gap-3 p-4">
        <AlertCircle size={18} className="shrink-0 text-accent" />
        <p className="text-sm text-slate-600">
          {needsReviewCount === 0
            ? 'Nothing needs review right now.'
            : `${needsReviewCount} transaction${needsReviewCount === 1 ? '' : 's'} in this period still need a category.`}
        </p>
      </Card>
    </div>
  )
}
