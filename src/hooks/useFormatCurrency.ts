import { useUserSettings } from './useUserSettings'
import { formatCurrencyAs, formatCompactCurrencyAs, formatSignedCurrencyAs, DEFAULT_CURRENCY } from '@/lib/currency'

/** Formats amounts in the signed-in user's chosen currency (defaults to USD until settings load). */
export function useFormatCurrency() {
  const { data } = useUserSettings()
  const currency = data?.currency ?? DEFAULT_CURRENCY

  return {
    currency,
    format: (amount: number) => formatCurrencyAs(amount, currency),
    formatCompact: (amount: number) => formatCompactCurrencyAs(amount, currency),
    formatSigned: (amount: number, type: 'expense' | 'income' | 'transfer') => formatSignedCurrencyAs(amount, currency, type),
  }
}
