import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useMyTransactions, type Transaction } from '@/hooks/useTransactions'
import { useAccountKinds, useCardBills } from '@/hooks/useCards'
import { findCardPaymentExpenses, payableCards, type CardPaymentSuggestion } from '@/lib/cardPayments'

/** The signed-in user's expenses that look like a credit card bill paid from a bank account (counted twice). */
export function useCardPaymentSuggestions(): { suggestions: CardPaymentSuggestion<Transaction>[]; cardAccounts: string[] } {
  const { userId } = useAuth()
  const { data: transactions } = useMyTransactions(userId)
  const kinds = useAccountKinds()
  const bills = useCardBills()
  return useMemo(() => {
    const creditCards = [...kinds].filter(([, kind]) => kind === 'credit_card').map(([name]) => name)
    const hints = bills.map((b) => ({ account: b.account, due: b.due, dueDate: b.dueDate }))
    // The picker only offers real credit cards, not a legacy "… Debit Card" account awaiting conversion.
    return { suggestions: findCardPaymentExpenses(transactions ?? [], creditCards, hints), cardAccounts: payableCards(creditCards) }
  }, [transactions, kinds, bills])
}
