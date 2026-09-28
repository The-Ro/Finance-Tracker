import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { normalizeLast4, type DebitCard } from '@/lib/debitCards'

const UNIQUE_VIOLATION = '23505'
const FK_VIOLATION = '23503'

function friendlyError(error: { code?: string; message: string }): Error {
  if (error.code === UNIQUE_VIOLATION) return new Error('You already have a debit card with that name.')
  if (error.code === FK_VIOLATION) return new Error('Pick one of your savings or current accounts for this card.')
  return new Error(error.message)
}

/** The signed-in user's debit cards, in name order. */
export function useDebitCards() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['debit_cards', userId],
    enabled: !!userId,
    queryFn: async (): Promise<DebitCard[]> => {
      const { data, error } = await supabase
        .from('debit_cards')
        .select('*')
        .eq('owner_user_id', userId!)
        .order('name')
      if (error) throw error
      return data
    },
    staleTime: 30_000,
  })
}

export interface DebitCardInput {
  name: string
  /** Free text; normalized to 4 digits or null (throws otherwise). */
  last4?: string | null
  /** The savings/current account the card draws from. */
  account: string
}

export function useAddDebitCard() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: DebitCardInput): Promise<DebitCard> => {
      if (!userId) throw new Error('Not signed in')
      const name = input.name.trim()
      if (!name) throw new Error('Give the card a name.')
      const { data, error } = await supabase
        .from('debit_cards')
        .insert({ owner_user_id: userId, name, last4: normalizeLast4(input.last4), account: input.account })
        .select('*')
        .single()
      if (error) throw friendlyError(error)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debit_cards', userId] }),
  })
}

export function useUpdateDebitCard() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<DebitCardInput>) => {
      const patch: { name?: string; last4?: string | null; account?: string } = {}
      if (input.name !== undefined) {
        patch.name = input.name.trim()
        if (!patch.name) throw new Error('Give the card a name.')
      }
      if (input.last4 !== undefined) patch.last4 = normalizeLast4(input.last4)
      if (input.account !== undefined) patch.account = input.account
      const { error } = await supabase.from('debit_cards').update(patch).eq('id', id)
      if (error) throw friendlyError(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit_cards', userId] })
      // Moving a card to another account changes where its past spends are shown.
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

/** Deletes a card; its past transactions stay on the linked account (debit_card_id is set to null). */
export function useRemoveDebitCard() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('debit_cards').delete().eq('id', id)
      if (error) throw friendlyError(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit_cards', userId] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export interface ConvertResult {
  cardId: string
  /** Transactions moved onto the linked account. */
  moved: number
  /** Transfers between the two accounts, deleted because they'd now be a transfer to itself. */
  removedTransfers: number
}

/**
 * Turns an old account that was really a debit card ("HDFC Debit Card") into a
 * debit card on `linkedAccount`, moving its transactions there (RPC).
 */
export function useConvertAccountToDebitCard() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { account: string; linkedAccount: string; last4?: string | null }): Promise<ConvertResult> => {
      const { data, error } = await supabase.rpc('convert_account_to_debit_card', {
        p_account: input.account,
        p_linked_account: input.linkedAccount,
        p_last4: normalizeLast4(input.last4),
      })
      if (error) throw new Error(error.message)
      // One object from the RPC; tolerate a single-row array too.
      const row = (Array.isArray(data) ? data[0] : data) as typeof data
      return { cardId: row.card_id, moved: row.moved, removedTransfers: row.removed_transfers }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit_cards', userId] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', userId] })
      queryClient.invalidateQueries({ queryKey: ['recurring_items', userId] })
    },
  })
}
