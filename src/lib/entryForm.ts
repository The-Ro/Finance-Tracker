import { SUPPORTED_CURRENCIES } from '@/lib/currency'

/**
 * Account chips for Add entry: recently used accounts first (most recent
 * first), then every other account in its original order -- the full list,
 * custom accounts included. `exclude` drops one account (a transfer's other
 * side); `selected` is kept, up front, even if it's no longer in `all` (an
 * old entry being edited can reference an account that's since been removed),
 * so the current value is always visible and pressed.
 */
export function orderAccountOptions(
  all: string[],
  recent: string[],
  opts: { exclude?: string; selected?: string } = {}
): string[] {
  const { exclude, selected } = opts
  const out: string[] = []
  const seen = new Set<string>()
  const push = (account: string) => {
    if (!account || account === exclude || seen.has(account)) return
    seen.add(account)
    out.push(account)
  }
  if (selected && !all.includes(selected)) push(selected)
  const known = new Set(all)
  for (const account of recent) if (known.has(account)) push(account)
  for (const account of all) push(account)
  return out
}

interface SecondaryFields {
  payment_method?: string | null
  remarks?: string | null
  tags?: string[] | null
  receipt?: boolean | null
}

/** How many of the fields tucked under "More details" are filled in. An
 *  entry being edited with any of them set opens the disclosure on its own. */
export function countSecondaryFields(t: SecondaryFields): number {
  let n = 0
  if (t.payment_method) n++
  if (t.remarks?.trim()) n++
  if (t.tags && t.tags.length > 0) n++
  if (t.receipt) n++
  return n
}

/** Symbol for the big amount figure: "₹", "€", "CA$"; the code itself for a currency we don't list. */
export function currencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

/** "Saved · Fresh Mart ₹1,284.00" -- the toast after a new entry is saved. */
export function savedEntryMessage(merchant: string, formattedAmount: string): string {
  const name = merchant.trim()
  return name ? `Saved · ${name} ${formattedAmount}` : `Saved · ${formattedAmount}`
}
