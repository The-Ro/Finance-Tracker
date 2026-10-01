import { useEffect, useMemo, useState } from 'react'
import { DateRangeSheet } from '@/components/transactions/DateRangeSheet'
import { rangeFromParams } from '@/lib/activityLink'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, AlertTriangle, Check, Copy, Download, X, CalendarDays } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import {
  useMyTransactions,
  useEveryoneTransactions,
  useMyTransactionsPaginated,
  useEveryoneTransactionsPaginated,
  usePrivateEntries,
  TRANSACTIONS_QUERY_LIMIT,
} from '@/hooks/useTransactions'
import { useProfiles } from '@/hooks/useProfiles'
import { useRequestedAccessRows } from '@/hooks/useSharing'
import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import { useDebitCards } from '@/hooks/useDebitCards'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { useCardPaymentSuggestions } from '@/hooks/useCardPaymentSuggestions'
import { CardPaymentNotice } from '@/components/cards/CardPaymentNotice'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
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
import { resolvePeriod, isWithinRange, type DateRange } from '@/lib/period'
import { transactionsToCsv, downloadCsv } from '@/lib/csvExport'
import { findDuplicateGroups } from '@/lib/duplicates'
import { todayISO, formatShortDate } from '@/lib/format'
import { EMPTY_TRANSACTION_FILTERS, matchesFilters, type TransactionFilters } from '@/lib/transactionSearch'
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
  // A link from a budget (Budgets, Review) opens Activity on one category over
  // that budget's span: ?category=Bike&since=2026-09-30&until=2026-10-01.
  const [searchParams, setSearchParams] = useSearchParams()
  const [linkRange, setLinkRange] = useState<DateRange | null>(() => rangeFromParams(searchParams))
  const [filters, setFilters] = useState<TransactionFilters>(() => ({
    ...EMPTY_TRANSACTION_FILTERS,
    category: searchParams.get('category') || null,
  }))
  useEffect(() => {
    // Read once; drop the params so the period picker takes over again later.
    if (searchParams.has('category') || searchParams.has('until')) setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
  const range = linkRange ?? resolvePeriod(period)
  // "Pick dates": one day or a from-to span (DateRangeSheet), shown as the chip above.
  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const rangeLabel = (r: DateRange) =>
    !r.start
      ? `Until ${formatShortDate(r.end)}`
      : r.start === r.end
        ? formatShortDate(r.start)
        : `${formatShortDate(r.start)} – ${formatShortDate(r.end)}`

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

  // Everyone view: entries people kept to themselves show as blurred rows. Only
  // with no search/type/category/account/mode filter (nothing about them can
  // match one), and only back to the oldest loaded day while more pages remain.
  const unfiltered = !filters.search.trim() && !filters.type && !filters.category && !filters.account && !filters.paymentMethod
  const privateEntries = usePrivateEntries(range, scope === 'everyone' && unfiltered)
  const privateRows = useMemo(() => {
    if (scope !== 'everyone' || !unfiltered) return []
    let rows = privateEntries.data ?? []
    if (filters.ownerId) rows = rows.filter((r) => r.owner_user_id === filters.ownerId)
    const oldest = paginatedSource[paginatedSource.length - 1]?.date
    if (paginated.hasNextPage && oldest) rows = rows.filter((r) => r.date >= oldest)
    return rows
  }, [scope, unfiltered, privateEntries.data, filters.ownerId, paginatedSource, paginated.hasNextPage])

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
  // Scope + period, then the same search/category/account/mode/person filters
  // as the list (the type filter is left out: these two totals are the type
  // filter), so filtering to one shop shows what went in and out there.
  const { totalCredit, totalDebit } = useMemo(() => {
    let credit = 0
    let debit = 0
    for (const t of inPeriod) {
      if (!matchesFilters(t, serverFilters, { ignoreType: true })) continue
      if (t.type === 'income') credit += t.amount
      else if (t.type === 'expense') debit += t.amount
    }
    return { totalCredit: credit, totalDebit: debit }
  }, [inPeriod, serverFilters])
  // The totals count up to their value (and between values when the period changes).
  const shownCredit = useAnimatedNumber(totalCredit)
  const shownDebit = useAnimatedNumber(totalDebit)

  // Exports the same scope+period-filtered set the header totals above are
  // computed from -- not the table's own search/type/category/account/person
  // filters, which are for narrowing what's browsed, not for scoping export.
  // Green / red totals double as the type filter; tapping the active one clears it.
  const toggleType = (type: 'income' | 'expense') =>
    setFilters((f) => ({ ...f, type: f.type === type ? null : type }))

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
            {/* Tap to show only money in / only money out (tap again for all). */}
            <div className="hidden w-fit items-center divide-x divide-app-border overflow-hidden rounded-full border border-app-border bg-white text-helper font-medium sm:inline-flex">
              <button
                type="button"
                aria-pressed={filters.type === 'income'}
                onClick={() => toggleType('income')}
                title={`Credit -- ${formatSigned(totalCredit, 'income')} in this period. Tap to show only money in.`}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1 text-positive transition-colors',
                  filters.type === 'income' ? 'bg-positive-light font-bold' : 'hover:bg-positive-light/60'
                )}
              >
                <ArrowDownRight size={12} />
                {formatCompact(shownCredit)}
              </button>
              <button
                type="button"
                aria-pressed={filters.type === 'expense'}
                onClick={() => toggleType('expense')}
                title={`Debit -- ${formatSigned(totalDebit, 'expense')} out this period. Tap to show only money out.`}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1 text-danger transition-colors',
                  filters.type === 'expense' ? 'bg-danger-light font-bold' : 'hover:bg-danger-light/60'
                )}
              >
                <ArrowUpRight size={12} />
                {formatCompact(shownDebit)}
              </button>
            </div>
          </>
        }
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {/* The period is the same filter-icon pill as Home's. */}
            <div className="mr-auto flex min-w-0 items-center gap-2 sm:mr-0">
              {linkRange ? (
                // Picked dates (or a budget link): tap to change them, x for the usual period.
                <span className="animate-pop-in inline-flex min-h-[44px] min-w-0 items-center rounded-full border border-accent bg-accent-light text-helper font-semibold text-accent-on-light">
                  <button type="button" onClick={() => setDateSheetOpen(true)} className="min-h-[44px] truncate pl-3 pr-1">
                    {rangeLabel(linkRange)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkRange(null)}
                    aria-label="Show the usual period"
                    className="flex h-11 w-9 shrink-0 items-center justify-center"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </span>
              ) : (
                <>
                  <PeriodSelector compact value={period} onChange={(value) => settings.updatePeriod.mutate(value)} />
                  <button
                    type="button"
                    onClick={() => setDateSheetOpen(true)}
                    aria-label="Pick dates"
                    title="Pick dates"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-card text-slate-600 hover:border-accent"
                  >
                    <CalendarDays size={17} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={inPeriod.length === 0}
              aria-label="Export"
              title="Export"
              className="shrink-0 gap-1 px-3 !text-helper sm:gap-2 sm:px-4 sm:!text-sm"
            >
              <Download size={16} aria-hidden="true" />
              {/* Icon only on phones: three labelled pills were wider than an iPhone and pushed the page sideways. */}
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDuplicatesOpen(true)}
              aria-label="Duplicates"
              title="Duplicates"
              className="shrink-0 gap-1 px-3 !text-helper sm:gap-2 sm:px-4 sm:!text-sm"
            >
              <Copy size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Duplicates</span>
              {duplicateGroups.length > 0 && (
                <span className="rounded-full bg-caution-light px-1.5 text-helper font-semibold text-caution">
                  {duplicateGroups.length}
                </span>
              )}
            </Button>
          </div>
        }
      />

      {/* Phones: the credit/debit capsule becomes two tiles (same numbers). They
          are the type filter too: tap green for money in only, red for money
          out only, tap the selected one again for everything. */}
      <div className="animate-fade-in-up grid grid-cols-2 gap-3 sm:hidden" role="group" aria-label="Show money in or money out">
        {(
          [
            { type: 'income', label: 'Money in', total: totalCredit, shown: shownCredit, Icon: ArrowDownRight, tone: 'text-positive', bg: 'bg-positive-light', ring: 'ring-positive' },
            { type: 'expense', label: 'Money out', total: totalDebit, shown: shownDebit, Icon: ArrowUpRight, tone: 'text-danger', bg: 'bg-danger-light', ring: 'ring-danger' },
          ] as const
        ).map(({ type, label, total, shown, Icon, tone, bg, ring }) => {
          const active = filters.type === type
          const dimmed = filters.type !== null && !active
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() => toggleType(type)}
              className={clsx(
                'flex min-w-0 flex-col gap-1 rounded-card p-3.5 text-left transition-all active:scale-[0.98]',
                bg,
                active && ['ring-2', ring],
                dimmed && 'opacity-50'
              )}
            >
              <span className={clsx('flex items-center gap-1.5 text-helper font-bold', tone)}>
                <Icon size={14} aria-hidden="true" />
                {label}
                {active && <Check size={14} aria-hidden="true" className="ml-auto" />}
              </span>
              <span className="truncate font-serif text-xl font-semibold tabular-nums text-slate-900" title={format(total)}>
                {format(shown)}
              </span>
            </button>
          )
        })}
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
          privateRows={privateRows}
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
      <DateRangeSheet open={dateSheetOpen} initial={linkRange} onClose={() => setDateSheetOpen(false)} onApply={setLinkRange} />
      <DuplicatesModal open={duplicatesOpen} onClose={() => setDuplicatesOpen(false)} groups={duplicateGroups} />
    </div>
  )
}
