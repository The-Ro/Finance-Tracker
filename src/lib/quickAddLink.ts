/**
 * Values an iPhone Shortcut (or any link) can pass to open New entry already
 * filled in: /?add=expense&amount=450&payee=Swiggy&category=Dining&date=2026-10-04
 * The person still checks it and taps Save -- nothing is saved from a link.
 */
export interface QuickAddValues {
  amount?: number
  merchant?: string
  category?: string
  date?: string
}

export function quickAddFromParams(params: URLSearchParams): QuickAddValues {
  const out: QuickAddValues = {}
  const rawAmount = params.get('amount')
  if (rawAmount) {
    const n = Number(rawAmount.replace(/[₹,\s]/g, ''))
    if (Number.isFinite(n) && n > 0 && n < 1e10) out.amount = Math.round(n * 100) / 100
  }
  const payee = (params.get('payee') ?? params.get('note') ?? '').trim()
  if (payee) out.merchant = payee.slice(0, 60)
  const category = (params.get('category') ?? '').trim()
  if (category) out.category = category.slice(0, 40)
  const date = params.get('date')
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date))) out.date = date
  return out
}
