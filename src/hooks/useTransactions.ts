import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { buildFingerprint } from '@/lib/fingerprint'
import { applyRules, type SimpleRule } from '@/lib/rules'
import type { Database, PaymentMethod, TransactionType } from '@/types/database.types'

export type Transaction = Database['public']['Tables']['transactions']['Row']

export interface NewTransactionInput {
  date: string
  merchant: string
  category: string
  amount: number
  type: TransactionType
  account: string
  toAccount?: string | null
  remarks?: string | null
  paymentMethod?: PaymentMethod | null
  tags: string[]
  receipt: boolean
  receiptDocumentId?: string | null
}

const DUPLICATE_CODE = '23505'

function invalidateTransactionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['transactions'] })
}

export function useMyTransactions(userId: string | null) {
  return useQuery({
    queryKey: ['transactions', 'mine', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('owner_user_id', userId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5000)
      if (error) throw error
      return data
    },
  })
}

export function useEveryoneTransactions() {
  return useQuery({
    queryKey: ['transactions', 'everyone'],
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5000)
      if (error) throw error
      return data
    },
  })
}

export function useAddTransaction() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: NewTransactionInput & { rules?: SimpleRule[] }) => {
      if (!userId) throw new Error('Not signed in')

      let category = input.category
      let tags = input.tags
      if (input.rules && input.type !== 'transfer' && category === 'Needs review') {
        const applied = applyRules(input.merchant, category, tags, input.rules)
        category = applied.category
        tags = applied.tags
      }

      const fingerprint = buildFingerprint({
        date: input.date,
        merchant: input.merchant,
        amount: input.amount,
        account: input.account,
      })

      const { error } = await supabase.from('transactions').insert({
        owner_user_id: userId,
        date: input.date,
        merchant: input.merchant.trim(),
        category,
        amount: input.amount,
        type: input.type,
        account: input.account,
        to_account: input.toAccount ?? null,
        remarks: input.remarks?.trim() || null,
        payment_method: input.paymentMethod ?? null,
        tags,
        receipt: input.receipt,
        receipt_document_id: input.receiptDocumentId ?? null,
        source: 'manual',
        fingerprint,
      })

      if (error) {
        if (error.code === DUPLICATE_CODE) {
          throw new Error('This looks like a duplicate of a transaction you already logged.')
        }
        throw error
      }
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

export interface UpdateTransactionInput {
  id: string
  date: string
  merchant: string
  category: string
  amount: number
  type: TransactionType
  account: string
  toAccount?: string | null
  remarks?: string | null
  paymentMethod?: PaymentMethod | null
  tags: string[]
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateTransactionInput) => {
      const fingerprint = buildFingerprint({
        date: input.date,
        merchant: input.merchant,
        amount: input.amount,
        account: input.account,
      })

      const { error } = await supabase
        .from('transactions')
        .update({
          date: input.date,
          merchant: input.merchant.trim(),
          category: input.category,
          amount: input.amount,
          type: input.type,
          account: input.account,
          to_account: input.toAccount ?? null,
          remarks: input.remarks?.trim() || null,
          payment_method: input.paymentMethod ?? null,
          tags: input.tags,
          fingerprint,
        })
        .eq('id', input.id)

      if (error) {
        if (error.code === DUPLICATE_CODE) {
          throw new Error('This looks like a duplicate of a transaction you already logged.')
        }
        throw error
      }
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

export function useUpdateTransactionCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase.from('transactions').update({ category }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

export function useUpdateTransactionTags() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const { error } = await supabase.from('transactions').update({ tags }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

export interface BulkImportRow {
  date: string
  merchant: string
  category: string
  amount: number
  type: TransactionType
  account: string
}

export interface BulkImportResult {
  inserted: number
  duplicates: number
  skipped: number
}

export function useBulkImportTransactions() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      rows: BulkImportRow[]
      skippedDuringParsing: number
      rules: SimpleRule[]
    }): Promise<BulkImportResult> => {
      if (!userId) throw new Error('Not signed in')
      if (input.rows.length === 0) {
        return { inserted: 0, duplicates: 0, skipped: input.skippedDuringParsing }
      }

      const payload = input.rows.map((row) => {
        const applied =
          row.category === 'Needs review' ? applyRules(row.merchant, row.category, [], input.rules) : null
        const category = applied?.category ?? row.category
        return {
          owner_user_id: userId,
          date: row.date,
          merchant: row.merchant.trim(),
          category,
          amount: row.amount,
          type: row.type,
          account: row.account,
          tags: applied?.tags ?? [],
          receipt: false,
          source: 'csv' as const,
          fingerprint: buildFingerprint({
            date: row.date,
            merchant: row.merchant,
            amount: row.amount,
            account: row.account,
          }),
        }
      })

      const { data, error } = await supabase
        .from('transactions')
        .upsert(payload, { onConflict: 'owner_user_id,fingerprint', ignoreDuplicates: true })
        .select('id')

      if (error) throw error

      const inserted = data?.length ?? 0
      return {
        inserted,
        duplicates: payload.length - inserted,
        skipped: input.skippedDuringParsing,
      }
    },
    onSuccess: () => invalidateTransactionQueries(queryClient),
  })
}

const RECENT_ACCOUNTS_LIMIT = 4

/**
 * The `limit` most recently-used accounts (by the owner's own transaction
 * history), most recent first -- for pinning above the full alphabetical
 * list in an account picker. `useMyTransactions` already orders by
 * date desc/created_at desc, so the first occurrence of each account name
 * while walking that list is already its most recent use.
 */
export function useRecentAccounts(userId: string | null, limit = RECENT_ACCOUNTS_LIMIT): string[] {
  const { data: transactions } = useMyTransactions(userId)
  return useMemo(() => {
    if (!transactions) return []
    const seen = new Set<string>()
    for (const t of transactions) {
      if (seen.size >= limit) break
      seen.add(t.account)
    }
    return Array.from(seen)
  }, [transactions, limit])
}
