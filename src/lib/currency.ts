export interface CurrencyOption {
  code: string
  label: string
  symbol: string
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
]

export const DEFAULT_CURRENCY = 'USD'

export function formatCurrencyAs(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: DEFAULT_CURRENCY }).format(amount)
  }
}

export function formatSignedCurrencyAs(
  amount: number,
  currency: string,
  type: 'expense' | 'income' | 'transfer'
): string {
  const sign = type === 'income' ? '+' : type === 'expense' ? '−' : ''
  return `${sign}${formatCurrencyAs(Math.abs(amount), currency)}`
}
