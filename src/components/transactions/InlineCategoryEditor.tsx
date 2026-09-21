import { useState } from 'react'
import { Dropdown } from '@/components/ui/Dropdown'
import { useCategories } from '@/hooks/useLookupLists'
import { useUpdateTransactionCategory } from '@/hooks/useTransactions'
import type { TransactionType } from '@/types/database.types'

interface InlineCategoryEditorProps {
  transactionId: string
  category: string
  type: TransactionType
  editable: boolean
}

export function InlineCategoryEditor({ transactionId, category, type, editable }: InlineCategoryEditorProps) {
  const { expense, income } = useCategories()
  const categories = type === 'income' ? income : expense
  const update = useUpdateTransactionCategory()
  const [error, setError] = useState(false)

  if (!editable) {
    return (
      <span className="inline-flex w-fit items-center rounded-lg bg-accent-light px-2.5 py-1 text-xs font-medium text-accent-on-light">
        {category}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Dropdown
        options={categories.includes(category) ? categories : [category, ...categories]}
        value={category}
        aria-label="Category"
        className="min-h-[36px] min-w-0"
        onChange={async (e) => {
          setError(false)
          try {
            await update.mutateAsync({ id: transactionId, category: e.target.value })
          } catch {
            setError(true)
          }
        }}
      />
      {error && <span className="text-helper text-red-600">Couldn't save, try again.</span>}
    </div>
  )
}
