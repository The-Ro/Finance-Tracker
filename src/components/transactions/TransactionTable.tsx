import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { CheckSquare, ListFilter, Pencil, Receipt, Search, Split, Trash2, X } from 'lucide-react'
import { AccountKindIcon, DebitCardIcon } from '@/components/ui/AccountKindIcon'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { useAccountKinds } from '@/hooks/useCards'
import { Dropdown } from '@/components/ui/Dropdown'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { InlineCategoryEditor } from './InlineCategoryEditor'
import { InlineTagEditor } from './InlineTagEditor'
import { Avatar } from '@/components/ui/Avatar'
import type { Transaction } from '@/hooks/useTransactions'
import { useDeleteTransaction, useBulkDeleteTransactions, useBulkUpdateTransactionCategory } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useLookupLists'
import { useToast } from '@/context/ToastContext'
import { useViewReceipt } from '@/hooks/useDocuments'
import type { ProfileMap } from '@/hooks/useProfiles'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { formatDate, todayISO } from '@/lib/format'
import { formatCurrencyAs } from '@/lib/currency'
import type { TransactionScope } from './ScopeToggle'
import { SwipeRow, type SwipeAction } from './SwipeRow'
import { DEBIT_CARD_FILTER_PREFIX, hasActiveFilters, type TransactionFilters } from '@/lib/transactionSearch'
import { debitCardLabel, type DebitCard } from '@/lib/debitCards'
import { avatarTone, dayHeadingLabel, groupByDay, QUICK_TYPE_CHIPS, type AvatarTone } from '@/lib/activityList'

const BULK_CATEGORY_PLACEHOLDER = 'Change category…'

// Merchant-initial avatar tints (phones). Theme tokens only, so they follow
// light/dark mode and the accent preset; green stays reserved for income.
const TONE_CLASSES: Record<AvatarTone, string> = {
  positive: 'bg-positive-light text-positive',
  accent: 'bg-accent-light text-accent-on-light',
  info: 'bg-info-light text-info',
  caution: 'bg-caution-light text-caution',
  neutral: 'bg-slate-100 text-slate-600',
}

// Desktop grid templates, shared by the column header and every row so the two
// can't drift apart. Built to fit from md (~700px of content) without sideways
// scrolling -- the sticky day headings need the list box not to scroll -- so
// the Tags column only appears from xl; below that, tags show under the merchant.
// Columns: select, [owner], merchant, category, account, [tags], amount, actions.
const DESKTOP_GRID_MINE =
  'md:grid-cols-[28px_minmax(0,2fr)_128px_minmax(0,1fr)_112px_104px] xl:grid-cols-[28px_minmax(0,2fr)_150px_minmax(0,1fr)_minmax(0,1.4fr)_112px_104px]'
const DESKTOP_GRID_EVERYONE =
  'md:grid-cols-[28px_32px_minmax(0,2fr)_128px_minmax(0,1fr)_112px_104px] xl:grid-cols-[28px_32px_minmax(0,2fr)_150px_minmax(0,1fr)_minmax(0,1.4fr)_112px_104px]'

/** Square icon tool button (Filter, Select) -- same size everywhere they appear. */
function iconToolClass(active: boolean) {
  return clsx(
    'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
    active ? 'bg-accent-light text-accent-on-light' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
  )
}

function chipClass(active: boolean) {
  return clsx(
    'inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors',
    active ? 'border-accent bg-accent text-white' : 'border-app-border bg-app-card text-slate-600 hover:bg-slate-50'
  )
}

interface TransactionTableProps {
  transactions: Transaction[]
  scope: TransactionScope
  /** Shows Mine / Everyone chips in the quick-filter row (only when the user
   *  can actually see someone else's transactions). */
  onScopeChange?: (scope: TransactionScope) => void
  canChooseScope?: boolean
  currentUserId: string
  profiles: ProfileMap
  categories: string[]
  accounts: string[]
  /** The signed-in user's debit cards: rows paid with one show the card, and the account filter offers them. */
  debitCards?: DebitCard[]
  /** Search + dropdown filters are owned by the page and applied server-side
   *  (so they reach the whole history, not just what's paged in); this table
   *  only renders the controls and whatever rows come back. */
  filters: TransactionFilters
  onFiltersChange: (filters: TransactionFilters) => void
  /** Everyone-scope person filter options (id + display name). */
  peopleOptions: { id: string; name: string }[]
  /** More pages exist for the current search/filters -- shows a "Load more" footer. */
  hasMore?: boolean
  onLoadMore?: () => void
  loadingMore?: boolean
}

export function TransactionTable({
  transactions,
  scope,
  onScopeChange,
  canChooseScope = false,
  currentUserId,
  profiles,
  categories,
  accounts,
  debitCards = [],
  filters,
  onFiltersChange,
  peopleOptions,
  hasMore,
  onLoadMore,
  loadingMore,
}: TransactionTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null)
  // Phones: checkboxes only appear in "Select" mode (the desktop grid always
  // has its checkbox column); one swiped-open row at a time; the category/
  // account/person dropdowns sit behind a "Filters" disclosure.
  const [selectMode, setSelectMode] = useState(false)
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const deleteTransaction = useDeleteTransaction()
  const bulkDeleteTransactions = useBulkDeleteTransactions()
  const bulkUpdateCategory = useBulkUpdateTransactionCategory()
  const { formatSigned } = useFormatCurrency()
  const { openEditEntry, openSplit } = useGlobalModals()
  const viewReceipt = useViewReceipt()
  const { show } = useToast()
  const { expense: expenseCategories, income: incomeCategories } = useCategories()

  const handleViewReceipt = (documentId: string) => {
    viewReceipt.mutate(documentId, {
      onSuccess: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
    })
  }

  const ALL_PEOPLE = 'Everyone'
  // Labels are what the Dropdown emits, so two connections with the same
  // display name get their email appended to keep the id lookup unambiguous.
  const personLabels = useMemo(() => {
    const nameCounts = new Map<string, number>()
    for (const p of peopleOptions) nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1)
    return peopleOptions.map((p) => {
      const email = profiles[p.id]?.email
      return { id: p.id, label: (nameCounts.get(p.name) ?? 0) > 1 && email ? `${p.name} (${email})` : p.name }
    })
  }, [peopleOptions, profiles])
  const ownerLabel = personLabels.find((p) => p.id === filters.ownerId)?.label

  // Shared viewers can't read another owner's cards, so an unknown card id just
  // falls back to showing the account.
  const cardsById = useMemo(() => new Map(debitCards.map((c) => [c.id, c])), [debitCards])
  // Own accounts' kinds for the account tag's icon; a shared owner's account falls back to the bank icon.
  const kinds = useAccountKinds()
  const ALL_ACCOUNTS = 'All accounts'
  const ALL_TYPES = 'All types'
  // Accounts, then debit cards (as `debit:<id>`, filtered on debit_card_id); labels are what the Dropdown emits.
  const accountFilterOptions = useMemo(
    () => [
      ...accounts.map((name) => ({ label: name, value: name })),
      ...debitCards.map((card) => ({ label: `${debitCardLabel(card)} · debit card`, value: DEBIT_CARD_FILTER_PREFIX + card.id })),
    ],
    [accounts, debitCards]
  )
  const accountFilterLabel = accountFilterOptions.find((o) => o.value === filters.account)?.label ?? filters.account
  const filtersActive = hasActiveFilters(filters)
  const setFilter = (patch: Partial<TransactionFilters>) => onFiltersChange({ ...filters, ...patch })

  // Only the signed-in user's own rows can be bulk-selected -- a shared
  // "Everyone" row from someone else has no edit/delete affordance either.
  const editableFiltered = useMemo(() => transactions.filter((t) => t.owner_user_id === currentUserId), [transactions, currentUserId])

  // Drop any selected id that no longer appears in what's loaded -- e.g.
  // after a bulk action succeeds and those rows are gone, or a delete
  // happened elsewhere (another tab, "Load more" bringing in a fresh set).
  useEffect(() => {
    setSelected((prev) => {
      const loadedIds = new Set(transactions.map((t) => t.id))
      const next = new Set([...prev].filter((id) => loadedIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [transactions])

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allEditableSelected = editableFiltered.length > 0 && editableFiltered.every((t) => selected.has(t.id))
  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allEditableSelected) {
        const next = new Set(prev)
        for (const t of editableFiltered) next.delete(t.id)
        return next
      }
      return new Set([...prev, ...editableFiltered.map((t) => t.id)])
    })
  }

  // Day groups (with each day's net) over the rows loaded so far -- a "Load
  // more" page that continues a day lands in that day's existing group.
  const groups = useMemo(() => groupByDay(transactions), [transactions])
  const today = todayISO()
  const desktopGrid = scope === 'everyone' ? DESKTOP_GRID_EVERYONE : DESKTOP_GRID_MINE
  const showMobileCheckboxes = selectMode || selected.size > 0
  // Type counts too: the green/red totals on the page set it, and Transfers is picked here.
  const dropdownFilterCount = [filters.type, filters.category, filters.account, filters.ownerId].filter(Boolean).length
  const typeLabel = filters.type === null ? ALL_TYPES : (QUICK_TYPE_CHIPS.find((c) => c.type === filters.type)?.label ?? ALL_TYPES)

  const clearSelection = () => {
    setSelected(new Set())
    setSelectMode(false)
  }

  // Transfers carry no category, and income/expense each have their own
  // category list -- a mixed selection only gets categories valid for both.
  const categorizableSelected = useMemo(
    () => transactions.filter((t) => selected.has(t.id) && t.type !== 'transfer'),
    [transactions, selected]
  )
  const bulkCategoryOptions = useMemo(() => {
    const hasIncome = categorizableSelected.some((t) => t.type === 'income')
    const hasExpense = categorizableSelected.some((t) => t.type === 'expense')
    if (hasIncome && hasExpense) return expenseCategories.filter((c) => incomeCategories.includes(c))
    if (hasIncome) return incomeCategories
    if (hasExpense) return expenseCategories
    return []
  }, [categorizableSelected, expenseCategories, incomeCategories])
  const skippedTransfers = selected.size - categorizableSelected.length

  const handleBulkCategoryChange = (category: string) => {
    if (category === BULK_CATEGORY_PLACEHOLDER || categorizableSelected.length === 0) return
    bulkUpdateCategory.mutate(
      { ids: categorizableSelected.map((t) => t.id), category },
      {
        onSuccess: clearSelection,
        onError: () => show("Couldn't change the category. Try again.", { tone: 'error' }),
      }
    )
  }

  const handleBulkDelete = () => {
    bulkDeleteTransactions.mutate(Array.from(selected), {
      onSuccess: () => {
        clearSelection()
        setConfirmBulkDelete(false)
      },
      onError: () => show("Couldn't delete those transactions. Try again.", { tone: 'error' }),
    })
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    deleteTransaction.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
      onError: () => {
        setPendingDelete(null)
        show("Couldn't delete that transaction. Try again.", { tone: 'error' })
      },
    })
  }

  const renderRow = (t: Transaction) => {
    const owner = profiles[t.owner_user_id]
    const editable = t.owner_user_id === currentUserId
    const amountTone = t.type === 'income' ? 'text-positive' : t.type === 'expense' ? 'text-danger' : 'text-slate-600'
    const amountClassName = 'text-sm font-serif font-semibold ' + amountTone
    const amountLabel = t.type === 'income' ? 'Credit' : t.type === 'expense' ? 'Debit' : 'Transfer'
    // Paid with a known debit card: name the card; its account moves to the desktop subline.
    // Shared viewers can't read the owner's cards, so theirs fall back to the account.
    const card = t.debit_card_id ? cardsById.get(t.debit_card_id) : undefined
    const payer = card ? debitCardLabel(card) : t.account
    const accountDisplay = t.type === 'transfer' && t.to_account ? `${payer} → ${t.to_account}` : payer
    const methodNote = card ? `from ${t.account}` : t.payment_method ? `via ${t.payment_method}` : null

    const checkbox = editable && (
      <input
        type="checkbox"
        aria-label={`Select ${t.merchant}`}
        checked={selected.has(t.id)}
        onChange={() => toggleOne(t.id)}
        className="h-4 w-4 rounded border-app-border"
      />
    )

    const editButton = editable && (
      <button
        aria-label="Edit transaction"
        onClick={() => openEditEntry(t)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <Pencil size={14} />
      </button>
    )
    const splitButton = editable && t.type === 'expense' && (
      <button
        aria-label="Split expense"
        onClick={() => openSplit(t)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <Split size={14} />
      </button>
    )
    const deleteButton = editable && (
      <button
        aria-label="Delete transaction"
        onClick={() => setPendingDelete(t)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-danger-light hover:text-danger"
      >
        <Trash2 size={14} />
      </button>
    )

    // Phones: swipe-left actions, same rule as the desktop buttons --
    // only your own rows; Split only on expenses.
    // Solid fills with white text in light mode; the dark-mode tint
    // pairs keep contrast where --info/--danger are brightened.
    const swipeActions: SwipeAction[] =
      editable && !showMobileCheckboxes
        ? [
            { key: 'edit', label: 'Edit', icon: Pencil, onSelect: () => openEditEntry(t), className: 'bg-slate-600 text-white dark:bg-info-light dark:text-info' },
            ...(t.type === 'expense'
              ? [{ key: 'split', label: 'Split', icon: Split, onSelect: () => openSplit(t), className: 'bg-accent text-white' }]
              : []),
            {
              key: 'delete',
              label: 'Delete',
              icon: Trash2,
              onSelect: () => setPendingDelete(t),
              className: 'bg-danger text-white dark:bg-danger-light dark:text-danger',
            },
          ]
        : []
    const subline = [t.type === 'transfer' ? 'Transfer' : t.category, accountDisplay, card ? null : methodNote]
      .filter(Boolean)
      .join(' · ')
    const tagLine = t.tags.length ? t.tags.map((tag) => `#${tag}`).join(' ') : null
    const extraLine = [t.remarks, tagLine].filter(Boolean).join(' · ')

    return (
      <li key={t.id} className="border-t border-app-border first:border-t-0">
        {/* Mobile: compact swipeable row. Desktop: single grid row (below). Kept
            as two separate layouts rather than one shared grid -- the desktop row
            has too many cells of very different shapes (a dropdown, a tag editor,
            two-line amount, icon buttons) to reflow sensibly at phone width. */}
        <div className="md:hidden">
          <SwipeRow
            actions={swipeActions}
            open={openRowId === t.id}
            onOpenChange={(o) => setOpenRowId((prev) => (o ? t.id : prev === t.id ? null : prev))}
            label={t.merchant}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              {showMobileCheckboxes && checkbox && (
                <label className="-my-2 -ml-2 flex h-11 w-9 shrink-0 cursor-pointer items-center justify-center">
                  {checkbox}
                </label>
              )}
              <span
                aria-hidden="true"
                className={clsx(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold',
                  TONE_CLASSES[avatarTone(t.category, t.type)]
                )}
              >
                <CategoryIcon category={t.category} type={t.type} size={19} strokeWidth={2} />
              </span>
              {/* Left: merchant, then category. Right: amount, then the account (or
                  card) tag; the payment mode sits on the next line, right side -- grey text in one truncated
                  line was easy to miss. */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5 self-center">
                    <span className="truncate text-[15px] font-semibold text-slate-900" title={t.merchant}>
                      {t.merchant}
                    </span>
                    {t.receipt &&
                      (t.receipt_document_id ? (
                        <button
                          type="button"
                          aria-label="View receipt"
                          title="View receipt"
                          onClick={() => handleViewReceipt(t.receipt_document_id!)}
                          disabled={viewReceipt.isPending}
                          className="-my-3 flex h-11 w-8 shrink-0 items-center justify-center text-slate-400 hover:text-accent-dark disabled:opacity-50"
                        >
                          <Receipt size={13} />
                        </button>
                      ) : (
                        <Receipt size={13} className="shrink-0 text-slate-300" aria-label="Receipt noted, not attached" />
                      ))}
                    {scope === 'everyone' && owner && (
                      <Avatar avatar={owner.avatar} name={owner.displayName} size={18} className="shrink-0" />
                    )}
                  </div>
                  <div className={clsx('shrink-0 font-serif text-base font-semibold tabular-nums', amountTone)}>
                    <span className="sr-only">{amountLabel} </span>
                    {formatSigned(t.amount, t.type)}
                  </div>
                </div>
                {/* Category on the left; on the right, under the amount, the
                    account (or card) as a small tag. */}
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <span className="min-w-0 truncate pt-0.5 text-helper text-slate-500">
                    {t.type === 'transfer' ? 'Transfer' : t.category}
                  </span>
                  <div className="flex min-w-0 max-w-[65%] flex-col items-end gap-1" title={subline}>
                    {t.original_currency && t.original_amount != null && (
                      <span className="text-helper text-slate-400">{formatCurrencyAs(t.original_amount, t.original_currency)}</span>
                    )}
                    <div className="flex min-w-0 max-w-full items-center justify-end gap-1">
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                        {card ? (
                          <DebitCardIcon size={12} className="shrink-0 text-slate-500" />
                        ) : (
                          <AccountKindIcon kind={kinds.get(t.account)} size={12} className="shrink-0 text-slate-500" />
                        )}
                        <span className="truncate">{accountDisplay}</span>
                      </span>
                    </div>
                  </div>
                </div>
                {/* Next line: remarks / #tags on the left, the payment mode on
                    the right at the same level. */}
                {(extraLine || t.payment_method) && (
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-helper text-slate-400" title={extraLine || undefined}>
                      {extraLine}
                    </span>
                    {t.payment_method && (
                      <span className="inline-flex shrink-0 items-center rounded-md bg-info-light px-1.5 py-0.5 text-xs font-medium text-info">
                        via {t.payment_method}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SwipeRow>
        </div>

        {/* No Date cell: the day heading above the group already says it. */}
        <div className={clsx('hidden items-center gap-3 px-4 py-3 md:grid', desktopGrid)}>
          <div className="flex items-center justify-center">{checkbox}</div>
          {scope === 'everyone' && (
            <div className="flex items-center justify-center">
              {owner && <Avatar avatar={owner.avatar} name={owner.displayName} size={22} />}
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium text-slate-900" title={t.merchant}>
                {t.merchant}
              </span>
              {t.receipt &&
                (t.receipt_document_id ? (
                  <button
                    type="button"
                    aria-label="View receipt"
                    title="View receipt"
                    onClick={() => handleViewReceipt(t.receipt_document_id!)}
                    disabled={viewReceipt.isPending}
                    className="flex shrink-0 items-center justify-center text-slate-400 hover:text-accent-dark disabled:opacity-50"
                  >
                    <Receipt size={13} />
                  </button>
                ) : (
                  <Receipt size={13} className="shrink-0 text-slate-300" aria-label="Receipt noted, not attached" />
                ))}
            </div>
            {t.remarks && (
              <span className="truncate text-helper text-slate-400" title={t.remarks}>
                {t.remarks}
              </span>
            )}
            {/* Below xl there's no Tags column, so tags ride along here
                (read-only; Edit still changes them). */}
            {tagLine && (
              <span className="truncate text-helper text-slate-400 xl:hidden" title={tagLine}>
                {tagLine}
              </span>
            )}
          </div>
          <div className="min-w-0">
            {t.type === 'transfer' ? (
              <span className="w-fit rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                Transfer
              </span>
            ) : (
              <InlineCategoryEditor transactionId={t.id} category={t.category ?? ''} type={t.type} editable={editable} />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-700" title={accountDisplay}>
              {accountDisplay}
            </div>
            {methodNote && <div className="truncate text-helper text-slate-500">{methodNote}</div>}
          </div>
          <div className="hidden min-w-0 xl:block">
            <InlineTagEditor transactionId={t.id} tags={t.tags} editable={editable} />
          </div>
          <div className="min-w-0 text-right">
            <div className={amountClassName}>{formatSigned(t.amount, t.type)}</div>
            <div className="truncate text-helper text-slate-400">
              {t.original_currency && t.original_amount != null
                ? `${formatCurrencyAs(t.original_amount, t.original_currency)} · ${amountLabel}`
                : amountLabel}
            </div>
          </div>
          <div className="flex justify-end gap-1">
            {editButton}
            {splitButton}
            {deleteButton}
          </div>
        </div>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex min-h-[48px] flex-1 items-center gap-2.5 rounded-xl border border-app-border bg-white px-3.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
          <Search size={17} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            placeholder="Search merchant, category, tag"
            aria-label="Search transactions"
            className="min-h-[44px] min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
          />
          {/* Phones: Filter and Select are icon buttons at the end of the
              search box -- the one standard place for list tools. From md the
              filters are always inline and every row has a checkbox. */}
          <div className="-mr-1.5 flex shrink-0 items-center gap-0.5 md:hidden">
            <button
              type="button"
              aria-label={dropdownFilterCount > 0 ? `Filters (${dropdownFilterCount} on)` : 'Filters'}
              aria-expanded={filtersOpen}
              aria-controls="transaction-dropdown-filters"
              onClick={() => setFiltersOpen((o) => !o)}
              className={clsx(iconToolClass(filtersOpen || dropdownFilterCount > 0), 'relative')}
            >
              <ListFilter size={18} aria-hidden="true" />
              {dropdownFilterCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold leading-none text-white">
                  {dropdownFilterCount}
                </span>
              )}
            </button>
            {editableFiltered.length > 0 && (
              <button
                type="button"
                aria-label={showMobileCheckboxes ? 'Done selecting' : 'Select transactions'}
                aria-pressed={showMobileCheckboxes}
                onClick={() => (showMobileCheckboxes ? clearSelection() : setSelectMode(true))}
                className={iconToolClass(showMobileCheckboxes)}
              >
                <CheckSquare size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {/* Category/account/person: always inline from md up, behind the
            "Filters" chip below on phones. */}
        <div
          id="transaction-dropdown-filters"
          className={clsx(
            'flex-col gap-2 sm:flex-row sm:flex-wrap md:flex md:flex-nowrap',
            filtersOpen ? 'animate-fade-in flex' : 'hidden'
          )}
        >
          {scope === 'everyone' && peopleOptions.length > 0 && (
            <Dropdown
              options={[ALL_PEOPLE, ...personLabels.map((p) => p.label)]}
              value={ownerLabel ?? ALL_PEOPLE}
              aria-label="Filter by person"
              onChange={(e) =>
                setFilter({ ownerId: personLabels.find((p) => p.label === e.target.value)?.id ?? null })
              }
            />
          )}
          <Dropdown
            options={QUICK_TYPE_CHIPS.map((c) => (c.type === null ? ALL_TYPES : c.label))}
            value={typeLabel}
            aria-label="Filter by type"
            onChange={(e) => setFilter({ type: QUICK_TYPE_CHIPS.find((c) => c.label === e.target.value)?.type ?? null })}
          />
          <Dropdown
            options={['All categories', ...categories]}
            value={filters.category ?? 'All categories'}
            aria-label="Filter by category"
            onChange={(e) => setFilter({ category: e.target.value === 'All categories' ? null : e.target.value })}
          />
          <Dropdown
            options={[ALL_ACCOUNTS, ...accountFilterOptions.map((o) => o.label)]}
            value={accountFilterLabel ?? ALL_ACCOUNTS}
            aria-label="Filter by account or card"
            onChange={(e) =>
              setFilter({ account: accountFilterOptions.find((o) => o.label === e.target.value)?.value ?? null })
            }
          />
        </div>
      </div>

      {/* Mine / Everyone, when there's someone else's activity to see. The type
          filter moved to the page's green Money in / red Money out totals
          (and Transfers to the Type filter). */}
      {canChooseScope && onScopeChange && (
        <div role="group" aria-label="Whose transactions" className="flex gap-2">
          {(['mine', 'everyone'] as TransactionScope[]).map((sc) => (
            <button
              key={sc}
              type="button"
              aria-pressed={scope === sc}
              onClick={() => onScopeChange(sc)}
              className={chipClass(scope === sc)}
            >
              {sc === 'mine' ? 'Mine' : 'Everyone'}
            </button>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-light px-3 py-2">
          <span className="text-sm font-medium text-accent-on-light">
            {selected.size} selected
            {skippedTransfers > 0 && categorizableSelected.length > 0 && (
              <span className="font-normal"> · category skips {skippedTransfers} transfer{skippedTransfers === 1 ? '' : 's'}</span>
            )}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {bulkCategoryOptions.length > 0 && (
              <Dropdown
                options={bulkCategoryOptions}
                value={BULK_CATEGORY_PLACEHOLDER}
                aria-label="Bulk change category"
                disabled={bulkUpdateCategory.isPending}
                onChange={(e) => handleBulkCategoryChange(e.target.value)}
              />
            )}
            <Button
              variant="danger"
              onClick={() => setConfirmBulkDelete(true)}
              disabled={bulkDeleteTransactions.isPending}
              className="px-3"
            >
              <Trash2 size={14} />
              Delete
            </Button>
            <button
              type="button"
              aria-label="Clear selection"
              onClick={clearSelection}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-white/50"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions to show"
          description={
            filtersActive
              ? 'Nothing matches that search or filter. Try a different one.'
              : 'Add an entry or import a statement to get started.'
          }
        />
      ) : (
        // overflow-clip, not overflow-hidden/auto: those make this box a scroll
        // container, and the sticky day headings would then stick to it (which
        // never scrolls) instead of the page. The grid is sized to fit from md
        // up without sideways scrolling for the same reason.
        <div className="overflow-clip rounded-card border border-app-border bg-white">
          <div
            className={clsx(
              'hidden gap-3 border-b border-app-border bg-slate-50 px-4 py-2 text-helper font-medium uppercase tracking-wide text-slate-500 md:grid',
              desktopGrid
            )}
          >
            <div className="flex items-center justify-center">
              {editableFiltered.length > 0 && (
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allEditableSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-app-border"
                />
              )}
            </div>
            {scope === 'everyone' && <span />}
            <span>Merchant</span>
            <span>Category</span>
            <span>Account</span>
            <span className="hidden xl:block">Tags</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          {/* One group per day on every screen size: a heading that sticks under
              the top bar while its own rows scroll past, then that day's rows.
              Groups (not rows) rise in, so "Load more" pages don't replay it. */}
          <ul className="stagger-rows">
            {groups.map((group) => {
              const headingId = `tx-day-${group.date}`
              return (
                <li key={group.date} aria-labelledby={headingId} className="border-t border-app-border first:border-t-0">
                  {/* A clearly darker band than the rows (slate-200; a lifted grey in dark
                      mode, which has no slate-200 override) with dark text, so each day --
                      Today, Yesterday, Mon 21 Sep -- stands out when scrolling. */}
                  <div className="sticky top-[calc(76px+var(--safe-top))] z-10 flex min-h-[40px] items-center justify-between gap-3 border-b border-slate-300 bg-slate-200 px-4 py-2 text-helper font-bold uppercase tracking-wide text-slate-800 dark:border-[#454b59] dark:bg-[#3a3f4c]">
                    <h3 id={headingId}>{dayHeadingLabel(group.date, today)}</h3>
                    {group.net !== null && (
                      <span
                        className={clsx(
                          'tabular-nums normal-case tracking-normal',
                          group.net > 0 ? 'text-positive' : group.net < 0 ? 'text-danger' : 'text-slate-500'
                        )}
                        title="Net for the loaded entries of this day (transfers left out)"
                      >
                        <span className="sr-only">Net </span>
                        {formatSigned(group.net, group.net > 0 ? 'income' : group.net < 0 ? 'expense' : 'transfer')}
                      </span>
                    )}
                  </div>
                  <ul>{group.rows.map(renderRow)}</ul>
                </li>
              )
            })}
          </ul>
          {hasMore && (
            <div className="flex justify-center border-t border-app-border p-3">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="min-h-[44px] rounded-lg border border-app-border px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      <Modal
        open={confirmBulkDelete}
        onClose={() => {
          if (bulkDeleteTransactions.isPending) return
          setConfirmBulkDelete(false)
        }}
        title="Delete selected transactions"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleteTransactions.isPending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleBulkDelete} disabled={bulkDeleteTransactions.isPending}>
              {bulkDeleteTransactions.isPending ? 'Deleting…' : `Delete ${selected.size}`}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-700">
          Delete {selected.size} transaction{selected.size === 1 ? '' : 's'}? Any splits on them are removed too. This
          can't be undone.
        </p>
      </Modal>

      <ConfirmDeleteModal
        open={pendingDelete !== null}
        title="Delete transaction"
        pending={deleteTransaction.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      >
        {pendingDelete && (
          <p>
            Delete <span className="font-medium">{pendingDelete.merchant}</span> ({formatSigned(pendingDelete.amount, pendingDelete.type)},{' '}
            {formatDate(pendingDelete.date)})?
            {pendingDelete.type === 'expense' && ' Any split on it is removed too.'} This can't be undone.
          </p>
        )}
      </ConfirmDeleteModal>
    </div>
  )
}

