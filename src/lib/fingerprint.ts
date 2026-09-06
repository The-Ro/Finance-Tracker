/**
 * Duplicate-detection fingerprint. Must stay in sync with the unique
 * (owner_user_id, fingerprint) constraint in supabase/schema.sql -- the
 * database is the real duplicate guard, this is just what gets compared.
 */
export function buildFingerprint(params: {
  date: string
  merchant: string
  amount: number
  account: string
}): string {
  const { date, merchant, amount, account } = params
  return [date, merchant.trim().toLowerCase(), amount.toFixed(2), account.trim().toLowerCase()].join(
    '|'
  )
}
