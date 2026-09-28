/**
 * Duplicate-detection fingerprint. Must stay in sync with the unique
 * (owner_user_id, fingerprint) constraint in supabase/schema.sql -- the
 * database is the real duplicate guard, this is just what gets compared.
 *
 * An expense's fingerprint has no type suffix (the shape existing rows and the
 * mark_recurring_item_paid RPC already use); income and transfers are
 * suffixed so a same-day refund or transfer can't collide with a purchase.
 * supabase/migrations/2026-09-27_fingerprint_includes_type.sql rewrote
 * existing rows to match.
 */
export function buildFingerprint(params: {
  date: string
  merchant: string
  amount: number
  account: string
  type?: 'expense' | 'income' | 'transfer'
  toAccount?: string | null
}): string {
  const { date, merchant, amount, account, type, toAccount } = params
  const base = [date, merchant.trim().toLowerCase(), amount.toFixed(2), account.trim().toLowerCase()].join('|')
  if (type === 'income') return `${base}|income`
  if (type === 'transfer') return `${base}|transfer|${(toAccount ?? '').trim().toLowerCase()}`
  return base
}
