import { useState } from 'react'
import { useMoneyReminders, type MoneyReminder } from '@/hooks/useMoneyReminders'
import { useAddTransaction } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useToast } from '@/context/ToastContext'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { todayISO } from '@/lib/format'
import type { PaymentMethod } from '@/types/database.types'

/**
 * "Sent" on a money reminder -- the same step from Bills' list and from the
 * bell's quick tick. With "Log it when I tap Sent" the entry is added first
 * (saved account, mode and category) and only a logged reminder is ticked
 * off; otherwise it's ticked off and the toast offers "Log it".
 */
export function useMarkReminderSent() {
  const { setDone } = useMoneyReminders()
  const addTransaction = useAddTransaction()
  const { format } = useFormatCurrency()
  const { show } = useToast()
  const { openAddEntry } = useGlobalModals()
  const [busy, setBusy] = useState(false)

  const markSent = async (r: MoneyReminder): Promise<boolean> => {
    setBusy(true)
    try {
      if (r.log_entry && r.account && r.amount != null) {
        try {
          await addTransaction.mutateAsync({
            type: 'expense',
            amount: r.amount,
            merchant: r.title,
            date: todayISO(),
            category: r.category || 'Needs review',
            account: r.account,
            paymentMethod: (r.payment_method as PaymentMethod | null) ?? null,
            remarks: r.note,
            tags: [],
            receipt: false,
            allowDuplicate: true,
          })
        } catch (e) {
          show(`Couldn't log it: ${e instanceof Error ? e.message : 'try again'}`, { tone: 'error' })
          return false
        }
        await setDone.mutateAsync({ id: r.id, done: true })
        show(`Sent and logged · ${r.title} ${format(r.amount)}`)
        return true
      }
      await setDone.mutateAsync({ id: r.id, done: true })
      show('Marked as sent', {
        action: { label: 'Log it', onClick: () => openAddEntry('expense', { merchant: r.title, amount: r.amount ?? undefined }) },
      })
      return true
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not mark it sent.', { tone: 'error' })
      return false
    } finally {
      setBusy(false)
    }
  }

  return { markSent, busy }
}
