import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, AlertTriangle, Copy, Download } from 'lucide-react'
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
import { useRequestedAccessRows } from '@/hooks/useSharing'
import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import { useDebitCards } from '@/hooks/useDebitCards'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { useCardPaymentSuggestions } from '@/hooks/useCardPaymentSuggestions'
import { CardPaymentNotice } from '@/components/cards/CardPaymentNotice'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { PeriodSelector } from '@/components/ui/PeriodSelector'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import type { TransactionScope } from '@/components/transactions/ScopeToggle'
import { TransactionTable } from '@/components/transactions/TransactionTable'
import { DuplicatesModal } from '@/components/transactions/DuplicatesModal'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { resolvePeriod, isWithinRange } from '@/lib/period'
import { transactionsToCsv, downloadCsv } from '@/lib/csvExport'
import { findDuplicateGroups } from '@/lib/duplicates'
import { todayISO } from '@/lib/format'
import { EMPTY_TRANSACTION_FILTERS, type TransactionFilters } from '@/lib/transactionSearch'
import { SavedFilters } from '@/components/transactions/SavedFilters'
import { toFilters, type SavedFilter } from '@/lib/savedFilters'

function TransactionTableSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-4">
      {/* Stands in for the first day heading of the grouped list. */}
      <div className="flex items-center justify-between py-1">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-14" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
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
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_TRANSACTION_FILTERS)
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)
  // The search box updates `filters` on every keystroke; only the debounced
  // text reaches the server queries below.
  const debouncedSearch = useDebouncedValue(filters.search)
  const serverFilters = useMemo(() => ({ ...filters, search: debouncedSearch }), [filters, debouncedSearch])

  // A person filter only exists in the "Everyone" scope -- drop it on the way out.
  useEffect(() => {
    if (scope === 'mine') setFilters((f) => (f.ownerId ? { ...f, ownerId: null } : f))
  }, [scope])

  // Two independent data sources on purpose: myTransactions/everyoneTransactions
  // (full fetch, capped at TRANSACTIONS_QUERY_LIMIT) feeds the header
  // credit/debit capsule below, which needs a correct period-wide sum, not
  // just what's currently loaded into the browsable list. The *Paginated
  // hooks feed the actual table -- incrementally loaded via "Load more"
  // instead of capped -- see useMyTransactionsPaginated's doc comment.
  const myTransactions = useMyTransactions(userId)
  const everyoneTransactions = useEveryoneTransactions()
  const profiles = useProfiles()
  const requestedAccess = useRequestedAccessRows()
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const { data: debitCards = [] } = useDebitCards()
  const { inUse, ready: usageReady } = useAccountsInUse()
  const cardPayments = useCardPaymentSuggestions()
  // The account filter skips banks seeded at signup and never used (keeping whatever is picked).
  const filterAccounts = useMemo(
    () => (usageReady ? accounts.filter((a) => inUse.has(a) || a === filters.account) : accounts),
    [accounts, inUse, usageReady, filters.account]
  )

  const period = settings.data?.selectedPeriod ?? 'all-time'
  const range = resolvePeriod(period)

  const source = scope === 'mine' ? myTransactions.data ?? [] : everyoneTransactions.data ?? []
  const inPeriod = source.filter((t) => isWithinRange(t.date, range))
  // A list that comes back exactly at the query cap is the one observable
  // sign older rows got silently cut off -- affects the header totals above,
  // not the table below (which pages past this cap via "Load more").
  const isCapped = source.length === TRANSACTIONS_QUERY_LIMIT

  // Hooks can't be conditional, so both scopes' queries run and the active
  // one is picked below -- same as the two full-fetch queries above.
  const myTransactionsPaginated = useMyTransactionsPaginated(userId, serverFilters, range)
  const everyoneTransactionsPaginated = useEveryoneTransactionsPaginated(serverFilters, range)
  const paginated = scope === 'mine' ? myTransactionsPaginated : everyoneTransactionsPaginated
  const paginatedSource = useMemo(() => paginated.data?.pages.flat() ?? [], [paginated.data])

  // Person-filter options come from the (unfiltered) full fetch, so picking
  // one person doesn't shrink the list of people you can pick from.
  const peopleOptions = useMemo(() => {
    if (scope !== 'everyone') return []
    const names = new Map<string, string>()
    for (const t of everyoneTransactions.data ?? []) {
      const name = profiles.data?.[t.owner_user_id]?.displayName ?? profiles.data?.[t.owner_user_id]?.email
      if (name) names.set(t.owner_user_id, name)
    }
    return Array.from(names.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }))
  }, [scope, everyoneTransactions.data, profiles.data])

  // Mine / Everyone only means something once you can see someone else's
  // transactions: an approved request of yours, or (belt and braces) any
  // other owner's row already in the Everyone fetch. Stays visible while
  // Everyone is selected so there's always a way back.
  const canChooseScope = useMemo(
    () =>
      scope === 'everyone' ||
      (requestedAccess.data ?? []).some((r) => r.status === 'approved') ||
      (everyoneTransactions.data ?? []).some((t) => t.owner_user_id !== userId),
    [scope, requestedAccess.data, everyoneTransactions.data, userId]
  )

  // Restores a saved view. Entries saved before scope/period were remembered
  // don't carry them -- the current scope/period stay as they are then.
  const applySavedView = (view: SavedFilter) => {
    if (view.scope) setScope(view.scope)
    setFilters(toFilters(view))
    if (view.period && view.period !== period) settings.updatePeriod.mutate(view.period)
  }

  // Always the signed-in user's own transactions (regardless of scope) -- you
  // can only delete your own, so that's all a duplicate review can act on.
  const duplicateGroups = useMemo(() => findDuplicateGroups(myTransactions.data ?? []), [myTransactions.data])

  const { format, formatSigned, formatCompact } = useFormatCurrency()
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
            <div className="hidden w-fit items-center divide-x divide-app-border overflow-hidden rounded-full border border-app-border bg-white text-helper font-medium sm:inline-flex">
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
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {/* Phones: one row -- the period takes what's left (its trigger's 9rem
                minimum is lifted here) and the two labelled buttons stay compact. */}
            <div className="min-w-0 flex-1 sm:flex-none [&_button]:min-w-0 sm:[&_button]:min-w-[9rem]">
              <PeriodSelector value={period} onChange={(value) => settings.updatePeriod.mutate(value)} />
            </div>
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={inPeriod.length === 0}
              className="shrink-0 gap-1 px-2.5 !text-helper sm:gap-2 sm:px-4 sm:!text-sm"
            >
              <Download size={15} aria-hidden="true" />
              Export
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDuplicatesOpen(true)}
              className="shrink-0 gap-1 px-2.5 !text-helper sm:gap-2 sm:px-4 sm:!text-sm"
            >
              <Copy size={15} aria-hidden="true" />
              Duplicates
              {duplicateGroups.length > 0 && (
                <span className="rounded-full bg-caution-light px-1.5 text-helper font-semibold text-caution">
                  {duplicateGroups.length}
                </span>
              )}
            </Button>
          </div>
        }
      />

      {/* Phones: the credit/debit capsule becomes two tiles (same numbers). */}
      <div className="animate-fade-in-up grid grid-cols-2 gap-3 sm:hidden">
        <div className="flex min-w-0 flex-col gap-1 rounded-card bg-positive-light p-3.5">
          <span className="flex items-center gap-1.5 text-helper font-bold text-positive">
            <ArrowDownRight size={14} aria-hidden="true" />
            Money in
          </span>
          <span className="truncate font-serif text-xl font-semibold tabular-nums text-slate-900" title={format(totalCredit)}>
            {format(totalCredit)}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1 rounded-card bg-danger-light p-3.5">
          <span className="flex items-center gap-1.5 text-helper font-bold text-danger">
            <ArrowUpRight size={14} aria-hidden="true" />
            Money out
          </span>
          <span className="truncate font-serif text-xl font-semibold tabular-nums text-slate-900" title={format(totalDebit)}>
            {format(totalDebit)}
          </span>
        </div>
      </div>

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

      <CardPaymentNotice suggestions={cardPayments.suggestions} cardAccounts={cardPayments.cardAccounts} />

      <SavedFilters filters={filters} scope={scope} period={period} onApply={applySavedView} />

      {paginated.isLoading ? (
        <TransactionTableSkeleton />
      ) : (
        <TransactionTable
          transactions={paginatedSource}
          scope={scope}
          onScopeChange={setScope}
          canChooseScope={canChooseScope}
          currentUserId={userId ?? ''}
          profiles={profiles.data ?? {}}
          categories={categories}
          accounts={filterAccounts}
          debitCards={debitCards}
          filters={filters}
          onFiltersChange={setFilters}
          peopleOptions={peopleOptions}
          hasMore={paginated.hasNextPage}
          onLoadMore={() => paginated.fetchNextPage()}
          loadingMore={paginated.isFetchingNextPage}
        />
      )}
      <DuplicatesModal open={duplicatesOpen} onClose={() => setDuplicatesOpen(false)} groups={duplicateGroups} />
    </div>
  )
}
