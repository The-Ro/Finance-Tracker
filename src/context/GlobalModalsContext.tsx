import { createContext, useContext, useState, type ReactNode } from 'react'
import { AddEntryModal } from '@/components/transactions/AddEntryModal'
import { CsvImportModal } from '@/components/transactions/CsvImportModal'
import type { Transaction } from '@/hooks/useTransactions'

interface GlobalModalsContextValue {
  openAddEntry: () => void
  openEditEntry: (transaction: Transaction) => void
  openImport: () => void
}

const GlobalModalsContext = createContext<GlobalModalsContextValue | undefined>(undefined)

export function GlobalModalsProvider({ children }: { children: ReactNode }) {
  const [addEntryOpen, setAddEntryOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const closeEntryModal = () => {
    setAddEntryOpen(false)
    setEditingTransaction(null)
  }

  return (
    <GlobalModalsContext.Provider
      value={{
        openAddEntry: () => {
          setEditingTransaction(null)
          setAddEntryOpen(true)
        },
        openEditEntry: (transaction) => {
          setEditingTransaction(transaction)
          setAddEntryOpen(true)
        },
        openImport: () => setImportOpen(true),
      }}
    >
      {children}
      <AddEntryModal open={addEntryOpen} onClose={closeEntryModal} transaction={editingTransaction} />
      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </GlobalModalsContext.Provider>
  )
}

export function useGlobalModals(): GlobalModalsContextValue {
  const ctx = useContext(GlobalModalsContext)
  if (!ctx) throw new Error('useGlobalModals must be used within GlobalModalsProvider')
  return ctx
}
