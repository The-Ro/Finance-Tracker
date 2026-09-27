import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AddEntryModal } from '@/components/transactions/AddEntryModal'
import { CsvImportModal } from '@/components/transactions/CsvImportModal'
import { SplitModal } from '@/components/transactions/SplitModal'
import type { Transaction } from '@/hooks/useTransactions'
import type { TransactionType } from '@/types/database.types'

interface GlobalModalsContextValue {
  /** Opens Add entry for a new entry, optionally starting on a type. */
  openAddEntry: (initialType?: TransactionType) => void
  openEditEntry: (transaction: Transaction) => void
  openImport: () => void
  openSplit: (transaction: Transaction) => void
}

const GlobalModalsContext = createContext<GlobalModalsContextValue | undefined>(undefined)

export function GlobalModalsProvider({ children }: { children: ReactNode }) {
  const [addEntryOpen, setAddEntryOpen] = useState(false)
  const [initialType, setInitialType] = useState<TransactionType>('expense')
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [splitting, setSplitting] = useState<Transaction | null>(null)

  // Home-screen shortcut (vite.config.ts manifest.shortcuts): /?add=entry opens
  // Add entry straight away, then drops the param so a reload doesn't reopen it.
  useEffect(() => {
    const url = new URL(window.location.href)
    const add = url.searchParams.get('add')
    if (add !== 'entry' && add !== 'expense' && add !== 'income' && add !== 'transfer') return
    setInitialType(add === 'entry' ? 'expense' : add)
    setAddEntryOpen(true)
    url.searchParams.delete('add')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [])

  const closeEntryModal = () => {
    setAddEntryOpen(false)
    setEditingTransaction(null)
  }

  return (
    <GlobalModalsContext.Provider
      value={{
        openAddEntry: (type = 'expense') => {
          setInitialType(type)
          setEditingTransaction(null)
          setAddEntryOpen(true)
        },
        openEditEntry: (transaction) => {
          setEditingTransaction(transaction)
          setAddEntryOpen(true)
        },
        openImport: () => setImportOpen(true),
        openSplit: (transaction) => setSplitting(transaction),
      }}
    >
      {children}
      <AddEntryModal open={addEntryOpen} onClose={closeEntryModal} transaction={editingTransaction} initialType={initialType} />
      <SplitModal transaction={splitting} onClose={() => setSplitting(null)} />
      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </GlobalModalsContext.Provider>
  )
}

export function useGlobalModals(): GlobalModalsContextValue {
  const ctx = useContext(GlobalModalsContext)
  if (!ctx) throw new Error('useGlobalModals must be used within GlobalModalsProvider')
  return ctx
}
