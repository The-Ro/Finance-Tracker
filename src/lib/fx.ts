/**
 * Foreign-currency entry. A transaction's `amount` is always in the owner's
 * home currency (user_settings.currency), so every sum, budget and balance
 * works unchanged; a foreign-currency entry additionally stores
 * original_currency / original_amount / fx_rate, where
 * amount = round(original_amount * fx_rate, 2). The rate is fixed at entry
 * time (fetched, but editable) -- nothing re-converts later.
 *
 * Rates come from Frankfurter (European Central Bank reference rates, no API
 * key); only the two currency codes and the date are sent. If the lookup
 * fails, the user types the rate.
 */
export const FX_API_BASE = 'https://api.frankfurter.dev/v1'

export function convertToHome(originalAmount: number, rate: number): number {
  return Math.round(originalAmount * rate * 100) / 100
}

export function buildFxUrl(from: string, to: string, date: string): string {
  return `${FX_API_BASE}/${encodeURIComponent(date)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
}

/** Pulls the rate for `to` out of a Frankfurter response, or null if it's
 *  missing/not a positive number. `date` is the business day actually used
 *  (weekends/holidays fall back to the previous one). */
export function parseFxResponse(body: unknown, to: string): { rate: number; date: string } | null {
  if (typeof body !== 'object' || body === null) return null
  const { rates, date } = body as { rates?: Record<string, unknown>; date?: unknown }
  const rate = rates?.[to]
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null
  return { rate, date: typeof date === 'string' ? date : '' }
}

export async function fetchFxRate(
  from: string,
  to: string,
  date: string,
  signal?: AbortSignal
): Promise<{ rate: number; date: string }> {
  const res = await fetch(buildFxUrl(from, to, date), { signal })
  if (!res.ok) throw new Error(`Rate lookup failed (${res.status})`)
  const parsed = parseFxResponse(await res.json(), to)
  if (!parsed) throw new Error('No rate available for that currency and date')
  return parsed
}
