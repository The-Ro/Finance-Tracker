import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, AlertTriangle, Download } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import {
  useMyTransactions,
  useEveryoneTransactions,
  useMyTransactionsPaginated,
  useEveryoneTransactionsPaginated,
  TRANSACTIONS_QUERY_LIMIT,
} from '@/hooks/useTransactions'
import { useProfiles } from '@/hooks/useProfiles'
import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { PeriodSelector } from '@/components/ui/PeriodSelector'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { ScopeToggle, type TransactionScope } from '@/components/transactions/ScopeToggle'
import { TransactionTable } from '@/components/transactions/TransactionTable'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { resolvePeriod, isWithinRange } from '@/lib/period'
import { transactionsToCsv, downloadCsv } from '@/lib/csvExport'
import { todayISO } from '@/lib/format'

function TransactionTableSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </Card>
  )
}

export function TransactionsPage() {
  const { userId } = useAuth()
  const settings = useUserSettings()
  const [scope, setScope] = useState<TransactionScope>('mine')

  // Two independent data sources on purpose: myTransactions/everyoneTransactions
  // (full fetch, capped at TRANSACTIONS_QUERY_LIMIT) feeds the header
  // credit/debit capsule below, which needs a correct period-wide sum, not
  // just what's currently loaded into the browsable list. The *Paginated
  // hooks feed the actual table -- incrementally loaded via "Load more"
  // instead of capped -- see useMyTransactionsPaginated's doc comment.
  const myTransactions = useMyTransactions(userId)
  const everyoneTransactions = useEveryoneTransactions()
  const myTransactionsPaginated = useMyTransactionsPaginated(userId)
  const everyoneTransactionsPaginated = useEveryoneTransactionsPaginated()
  const profiles = useProfiles()
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()

  const period = settings.data?.selectedPeriod ?? 'all-time'
  const range = resolvePeriod(period)

  const source = scope === 'mine' ? myTransactions.data ?? [] : everyoneTransactions.data ?? []
  const inPeriod = source.filter((t) => isWithinRange(t.date, range))
  // A list that comes back exactly at the query cap is the one observable
  // sign older rows got silently cut off -- affects the header totals above,
  // not the table below (which pages past this cap via "Load more").
  const isCapped = source.length === TRANSACTIONS_QUERY_LIMIT

  const paginated = scope === 'mine' ? myTransactionsPaginated : everyoneTransactionsPaginated
  const paginatedSource = useMemo(() => paginated.data?.pages.flat() ?? [], [paginated.data])
  const paginatedInPeriod = useMemo(
    () => paginatedSource.filter((t) => isWithinRange(t.date, range)),
    [paginatedSource, range]
  )

  const { formatSigned, formatCompact } = useFormatCurrency()
  // Page-level, so this reflects scope + period like the heading it sits
  // next to -- not the table's own search/type/category/account/person
  // filters below, which narrow the list further without changing the page.
  const { totalCredit, totalDebit } = useMemo(() => {
    let credit = 0
    let debit = 0
    for (const t of inPeriod) {
      if (t.type === 'income') credit += t.amount
      else if (t.type === 'expense') debit += t.amount
    }
    return { totalCredit: credit, totalDebit: debit }
  }, [inPeriod])

  // Exports the same scope+period-filtered set the header totals above are
  // computed from -- not the table's own search/type/category/account/person
  // filters, which are for narrowing what's browsed, not for scoping export.
  const handleExport = () => {
    const ownerName =
      scope === 'everyone'
        ? (ownerUserId: string) => profiles.data?.[ownerUserId]?.displayName ?? profiles.data?.[ownerUserId]?.email ?? ownerUserId
        : undefined
    const csv = transactionsToCsv(inPeriod, ownerName)
    downloadCsv(`ledgeeaze-transactions-${scope}-${period}-${todayISO()}.csv`, csv)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={
          <>
            Transactions
            <div className="inline-flex w-fit items-center divide-x divide-app-border overflow-hidden rounded-full border border-app-border bg-white text-helper font-medium">
              <span
                title={`Credit -- ${formatSigned(totalCredit, 'income')} in this period`}
                className="flex items-center gap-1 px-2.5 py-1 text-positive"
              >
                <ArrowDownRight size={12} />
                {formatCompact(totalCredit)}
              </span>
              <span
                title={`Debit -- ${formatSigned(totalDebit, 'expense')} out this period`}
                className="flex items-center gap-1 px-2.5 py-1 text-danger"
              >
                <ArrowUpRight size={12} />
                {formatCompact(totalDebit)}
              </span>
            </div>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ScopeToggle value={scope} onChange={setScope} />
            <PeriodSelector value={period} onChange={(value) => settings.updatePeriod.mutate(value)} />
            <Button variant="secondary" onClick={handleExport} disabled={inPeriod.length === 0} className="px-3 sm:px-4">
              <Download size={16} />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        }
      />

      {isCapped && (
        <div className="flex items-center gap-2 rounded-lg bg-caution-light px-3 py-2 text-helper text-caution">
          <AlertTriangle size={14} className="shrink-0" />
          <span>
            The totals above are based on your most recent {TRANSACTIONS_QUERY_LIMIT.toLocaleString()} transactions
            -- older ones aren't included in that sum yet. The list below can still be paged through in full via
            "Load more".
          </span>
        </div>
      )}

      {paginated.isLoading ? (
        <TransactionTableSkeleton />
      ) : (
        <TransactionTable
          transactions={paginatedInPeriod}
          scope={scope}
          currentUserId={userId ?? ''}
          profiles={profiles.data ?? {}}
          categories={categories}
          accounts={accounts}
          hasMore={paginated.hasNextPage}
          onLoadMore={() => paginated.fetchNextPage()}
          loadingMore={paginated.isFetchingNextPage}
        />
      )}
    </div>
  )
}
