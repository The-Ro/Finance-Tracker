import { useMemo, useState } from 'react'
import { Pencil, Receipt, Trash2 } from 'lucide-react'
import { Dropdown } from '@/components/ui/Dropdown'
import { EmptyState } from '@/components/ui/EmptyState'
import { InlineCategoryEditor } from './InlineCategoryEditor'
import { InlineTagEditor } from './InlineTagEditor'
import { Avatar } from '@/components/ui/Avatar'
import type { Transaction } from '@/hooks/useTransactions'
import { useDeleteTransaction } from '@/hooks/useTransactions'
import type { ProfileMap } from '@/hooks/useProfiles'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { formatDate } from '@/lib/format'
import type { TransactionScope } from './ScopeToggle'

interface TransactionTableProps {
  transactions: Transaction[]
  scope: TransactionScope
  currentUserId: string
  profiles: ProfileMap
  categories: string[]
  accounts: string[]
}

export function TransactionTable({
  transactions,
  scope,
  currentUserId,
  profiles,
  categories,
  accounts,
}: TransactionTableProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [accountFilter, setAccountFilter] = useState('All accounts')
  const [typeFilter, setTypeFilter] = useState('All types')
  const [personFilter, setPersonFilter] = useState('Everyone')
  const deleteTransaction = useDeleteTransaction()
  const { formatSigned } = useFormatCurrency()
  const { openEditEntry } = useGlobalModals()

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
      if (categoryFilter !== 'All categories' && t.category !== categoryFilter) return false
      if (accountFilter !== 'All accounts' && t.account !== accountFilter) return false
      if (!q) return true
      return (
        t.merchant.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, search, categoryFilter, accountFilter, typeFilter, personFilter, scope])

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
          options={['All types', 'Income', 'Expense']}
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions to show"
          description={
            transactions.length === 0
              ? 'Add an entry or import a statement to get started.'
              : 'Try a different search or filter.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-app-border bg-white">
          {scope === 'everyone' ? (
            <div className="hidden min-w-[944px] grid-cols-[44px_100px_1fr_150px_120px_1fr_110px_40px_40px] gap-3 border-b border-app-border bg-slate-50 px-4 py-2 text-helper font-medium uppercase tracking-wide text-slate-500 md:grid">
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
            <div className="hidden min-w-[900px] grid-cols-[100px_1fr_150px_120px_1fr_110px_40px_40px] gap-3 border-b border-app-border bg-slate-50 px-4 py-2 text-helper font-medium uppercase tracking-wide text-slate-500 md:grid">
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
          <ul className={scope === 'everyone' ? 'md:min-w-[944px]' : 'md:min-w-[900px]'}>
            {filtered.map((t) => {
              const owner = profiles[t.owner_user_id]
              const editable = t.owner_user_id === currentUserId
              const amountClassName =
                'text-sm font-semibold ' + (t.type === 'income' ? 'text-positive' : 'text-caution')
              const amountLabel = t.type === 'income' ? 'Credit' : 'Debit'

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
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
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
                      <span className="text-sm text-slate-600">{formatDate(t.date)}</span>
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
                        {t.receipt && <Receipt size={13} className="shrink-0 text-slate-400" />}
                      </div>
                      {scope === 'everyone' && owner && (
                        <Avatar avatar={owner.avatar} name={owner.displayName} size={20} className="ml-auto shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <InlineCategoryEditor transactionId={t.id} category={t.category} editable={editable} />
                      <span className="shrink-0 text-sm text-slate-600">{t.account}</span>
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
                        ? 'md:grid-cols-[44px_100px_1fr_150px_120px_1fr_110px_40px_40px]'
                        : 'md:grid-cols-[100px_1fr_150px_120px_1fr_110px_40px_40px]')
                    }
                  >
                    {scope === 'everyone' && (
                      <div className="flex items-center justify-center">
                        {owner && <Avatar avatar={owner.avatar} name={owner.displayName} size={22} />}
                      </div>
                    )}
                    <div className="text-sm text-slate-600">{formatDate(t.date)}</div>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-900" title={t.merchant}>
                        {t.merchant}
                      </span>
                      {t.receipt && <Receipt size={13} className="shrink-0 text-slate-400" />}
                    </div>
                    <div>
                      <InlineCategoryEditor transactionId={t.id} category={t.category} editable={editable} />
                    </div>
                    <div className="text-sm text-slate-600">{t.account}</div>
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
        </div>
      )}
    </div>
  )
}
