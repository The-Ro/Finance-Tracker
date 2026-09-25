import { useEffect, useMemo, useState } from 'react'
import { Pencil, Receipt, Trash2, X } from 'lucide-react'
import { Dropdown } from '@/components/ui/Dropdown'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { InlineCategoryEditor } from './InlineCategoryEditor'
import { InlineTagEditor } from './InlineTagEditor'
import { Avatar } from '@/components/ui/Avatar'
import type { Transaction } from '@/hooks/useTransactions'
import { useDeleteTransaction, useBulkDeleteTransactions, useBulkUpdateTransactionCategory } from '@/hooks/useTransactions'
import { useViewReceipt } from '@/hooks/useDocuments'
import type { ProfileMap } from '@/hooks/useProfiles'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { formatDate } from '@/lib/format'
import type { TransactionScope } from './ScopeToggle'

const BULK_CATEGORY_PLACEHOLDER = 'Change category…'

interface TransactionTableProps {
  transactions: Transaction[]
  scope: TransactionScope
  currentUserId: string
  profiles: ProfileMap
  categories: string[]
  accounts: string[]
  /** More rows exist beyond what's currently loaded -- shows a "Load more"
   *  footer below the list. Search/filters above only ever apply to what's
   *  already loaded, so a search that should match an older, not-yet-loaded
   *  row won't find it until more is loaded -- documented tradeoff, not a bug. */
  hasMore?: boolean
  onLoadMore?: () => void
  loadingMore?: boolean
}

export function TransactionTable({
  transactions,
  scope,
  currentUserId,
  profiles,
  categories,
  accounts,
  hasMore,
  onLoadMore,
  loadingMore,
}: TransactionTableProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [accountFilter, setAccountFilter] = useState('All accounts')
  const [typeFilter, setTypeFilter] = useState('All types')
  const [personFilter, setPersonFilter] = useState('Everyone')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const deleteTransaction = useDeleteTransaction()
  const bulkDeleteTransactions = useBulkDeleteTransactions()
  const bulkUpdateCategory = useBulkUpdateTransactionCategory()
  const { formatSigned } = useFormatCurrency()
  const { openEditEntry } = useGlobalModals()
  const viewReceipt = useViewReceipt()

  const handleViewReceipt = (documentId: string) => {
    viewReceipt.mutate(documentId, {
      onSuccess: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
    })
  }

  const ALL_PEOPLE = 'Everyone'
  const peopleOptions = useMemo(() => {
    if (scope !== 'everyone') return []
    const names = new Map<string, string>()
    for (const t of transactions) {
      const name = profiles[t.owner_user_id]?.displayName ?? profiles[t.owner_user_id]?.email
      if (name) names.set(t.owner_user_id, name)
    }
    return Array.from(names.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }))
  }, [scope, transactions, profiles])
  const nameToOwnerId = new Map(peopleOptions.map((p) => [p.name, p.id]))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const personId = nameToOwnerId.get(personFilter)
    return transactions.filter((t) => {
      if (scope === 'everyone' && personFilter !== ALL_PEOPLE && t.owner_user_id !== personId) return false
      if (typeFilter === 'Income' && t.type !== 'income') return false
      if (typeFilter === 'Expense' && t.type !== 'expense') return false
      if (typeFilter === 'Transfer' && t.type !== 'transfer') return false
      if (categoryFilter !== 'All categories' && t.category !== categoryFilter) return false
      if (accountFilter !== 'All accounts' && t.account !== accountFilter) return false
      if (!q) return true
      return (
        t.merchant.toLowerCase().includes(q) ||
        (t.category ?? '').toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, search, categoryFilter, accountFilter, typeFilter, personFilter, scope])

  // Only the signed-in user's own rows can be bulk-selected -- a shared
  // "Everyone" row from someone else has no edit/delete affordance either.
  const editableFiltered = useMemo(() => filtered.filter((t) => t.owner_user_id === currentUserId), [filtered, currentUserId])

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

  const handleBulkCategoryChange = (category: string) => {
    if (category === BULK_CATEGORY_PLACEHOLDER || selected.size === 0) return
    bulkUpdateCategory.mutate(
      { ids: Array.from(selected), category },
      { onSuccess: () => setSelected(new Set()) }
    )
  }

  const handleBulkDelete = () => {
    bulkDeleteTransactions.mutate(Array.from(selected), {
      onSuccess: () => {
        setSelected(new Set())
        setConfirmBulkDelete(false)
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search merchant, category, or tag"
          className="min-h-[44px] flex-1 rounded-lg border border-app-border bg-white px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {scope === 'everyone' && peopleOptions.length > 0 && (
          <Dropdown
            options={[ALL_PEOPLE, ...peopleOptions.map((p) => p.name)]}
            value={personFilter}
            aria-label="Filter by person"
            onChange={(e) => setPersonFilter(e.target.value)}
          />
        )}
        <Dropdown
          options={['All types', 'Income', 'Expense', 'Transfer']}
          value={typeFilter}
          aria-label="Filter by type"
          onChange={(e) => setTypeFilter(e.target.value)}
        />
        <Dropdown
          options={['All categories', ...categories]}
          value={categoryFilter}
          aria-label="Filter by category"
          onChange={(e) => setCategoryFilter(e.target.value)}
        />
        <Dropdown
          options={['All accounts', ...accounts]}
          value={accountFilter}
          aria-label="Filter by account"
          onChange={(e) => setAccountFilter(e.target.value)}
        />
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-light px-3 py-2">
          <span className="text-sm font-medium text-accent-on-light">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Dropdown
              options={categories}
              value={BULK_CATEGORY_PLACEHOLDER}
              aria-label="Bulk change category"
              disabled={bulkUpdateCategory.isPending}
              onChange={(e) => handleBulkCategoryChange(e.target.value)}
            />
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
              onClick={() => setSelected(new Set())}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-white/50"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions to show"
          description={
            transactions.length === 0
              ? 'Add an entry or import a statement to get started.'
              : hasMore
                ? "Try a different search or filter, or load more -- what you're searching for might be further back."
                : 'Try a different search or filter.'
          }
          action={
            hasMore && (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="min-h-[44px] rounded-lg border border-app-border px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-app-border bg-white">
          {scope === 'everyone' ? (
            <div className="hidden min-w-[972px] grid-cols-[28px_44px_100px_1fr_150px_120px_1fr_110px_40px_40px] gap-3 border-b border-app-border bg-slate-50 px-4 py-2 text-helper font-medium uppercase tracking-wide text-slate-500 md:grid">
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
              <span />
              <span>Date</span>
              <span>Merchant</span>
              <span>Category</span>
              <span>Account</span>
              <span>Tags</span>
              <span className="text-right">Amount</span>
              <span />
              <span />
            </div>
          ) : (
            <div className="hidden min-w-[928px] grid-cols-[28px_100px_1fr_150px_120px_1fr_110px_40px_40px] gap-3 border-b border-app-border bg-slate-50 px-4 py-2 text-helper font-medium uppercase tracking-wide text-slate-500 md:grid">
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
              <span>Date</span>
              <span>Merchant</span>
              <span>Category</span>
              <span>Account</span>
              <span>Tags</span>
              <span className="text-right">Amount</span>
              <span />
              <span />
            </div>
          )}
          <ul className={scope === 'everyone' ? 'md:min-w-[972px]' : 'md:min-w-[928px]'}>
            {filtered.map((t) => {
              const owner = profiles[t.owner_user_id]
              const editable = t.owner_user_id === currentUserId
              const amountClassName =
                'text-sm font-mono font-semibold ' +
                (t.type === 'income' ? 'text-positive' : t.type === 'expense' ? 'text-danger' : 'text-slate-600')
              const amountLabel = t.type === 'income' ? 'Credit' : t.type === 'expense' ? 'Debit' : 'Transfer'
              const accountDisplay = t.type === 'transfer' && t.to_account ? `${t.account} → ${t.to_account}` : t.account

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
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil size={14} />
                </button>
              )
              const deleteButton = editable && (
                <button
                  aria-label="Delete transaction"
                  onClick={() => deleteTransaction.mutate(t.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-danger-light hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              )

              return (
                <li key={t.id} className="border-b border-app-border last:border-b-0">
                  {/* Mobile: stacked card. Desktop: single table row (below). Kept as two
                      separate layouts rather than one shared grid -- the row has too many
                      cells of very different shapes (a dropdown, a tag editor, two-line
                      amount, icon buttons) for one grid to reflow sensibly at 2 columns. */}
                  <div className="flex flex-col gap-2 px-4 py-3 md:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {checkbox}
                        <span className="text-sm text-slate-600">{formatDate(t.date)}</span>
                      </div>
                      <div className="text-right">
                        <div className={amountClassName}>{formatSigned(t.amount, t.type)}</div>
                        <div className="text-helper text-slate-400">{amountLabel}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-base font-semibold text-slate-900" title={t.merchant}>
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
                              className="flex shrink-0 items-center justify-center text-slate-400 hover:text-accent disabled:opacity-50"
                            >
                              <Receipt size={13} />
                            </button>
                          ) : (
                            <Receipt size={13} className="shrink-0 text-slate-300" aria-label="Receipt noted, not attached" />
                          ))}
                      </div>
                      {scope === 'everyone' && owner && (
                        <Avatar avatar={owner.avatar} name={owner.displayName} size={20} className="ml-auto shrink-0" />
                      )}
                    </div>
                    {t.remarks && (
                      <p className="truncate text-helper text-slate-400" title={t.remarks}>
                        {t.remarks}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      {t.type === 'transfer' ? (
                        <span className="w-fit rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                          Transfer
                        </span>
                      ) : (
                        <InlineCategoryEditor transactionId={t.id} category={t.category ?? ''} type={t.type} editable={editable} />
                      )}
                      <div className="shrink-0 text-right">
                        <span className="text-sm text-slate-600">{accountDisplay}</span>
                        {t.payment_method && <p className="text-helper text-slate-400">via {t.payment_method}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <InlineTagEditor transactionId={t.id} tags={t.tags} editable={editable} />
                      {editable && (
                        <div className="flex shrink-0">
                          {editButton}
                          {deleteButton}
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={
                      'hidden px-4 py-3 md:grid md:items-center md:gap-3 ' +
                      (scope === 'everyone'
                        ? 'md:grid-cols-[28px_44px_100px_1fr_150px_120px_1fr_110px_40px_40px]'
                        : 'md:grid-cols-[28px_100px_1fr_150px_120px_1fr_110px_40px_40px]')
                    }
                  >
                    <div className="flex items-center justify-center">{checkbox}</div>
                    {scope === 'everyone' && (
                      <div className="flex items-center justify-center">
                        {owner && <Avatar avatar={owner.avatar} name={owner.displayName} size={22} />}
                      </div>
                    )}
                    <div className="text-sm text-slate-600">{formatDate(t.date)}</div>
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
                              className="flex shrink-0 items-center justify-center text-slate-400 hover:text-accent disabled:opacity-50"
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
                    </div>
                    <div>
                      {t.type === 'transfer' ? (
                        <span className="w-fit rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                          Transfer
                        </span>
                      ) : (
                        <InlineCategoryEditor transactionId={t.id} category={t.category ?? ''} type={t.type} editable={editable} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-600" title={accountDisplay}>
                        {accountDisplay}
                      </div>
                      {t.payment_method && <div className="truncate text-helper text-slate-400">via {t.payment_method}</div>}
                    </div>
                    <div>
                      <InlineTagEditor transactionId={t.id} tags={t.tags} editable={editable} />
                    </div>
                    <div className="text-right">
                      <div className={amountClassName}>{formatSigned(t.amount, t.type)}</div>
                      <div className="text-helper text-slate-400">{amountLabel}</div>
                    </div>
                    <div className="flex justify-end">{editButton}</div>
                    <div className="flex justify-end">{deleteButton}</div>
                  </div>
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
          Delete {selected.size} transaction{selected.size === 1 ? '' : 's'}? This can't be undone.
        </p>
      </Modal>
    </div>
  )
}
