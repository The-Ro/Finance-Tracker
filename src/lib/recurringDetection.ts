import type { Cadence, RecurringKind } from '@/types/database.types'

export interface DetectableTransaction {
  date: string // YYYY-MM-DD
  merchant: string
  category: string
  amount: number
  tags: string[]
}

export interface RecurringCandidate {
  /** Stable key used for dismissal + de-duping against already-confirmed items. */
  patternKey: string
  merchant: string
  category: string
  cadence: Cadence
  occurrenceCount: number
  confidence: 'high' | 'likely'
  averageAmount: number
  monthlyEquivalent: number
  nextDate: string
  kind: RecurringKind
}

const SUBSCRIPTION_HINTS = [
  'netflix', 'spotify', 'hulu', 'disney', 'youtube', 'icloud', 'dropbox', 'adobe',
  'microsoft', 'amazon prime', 'patreon', 'membership', 'studio', 'gym', 'openai',
  'chatgpt', 'canva', 'notion', 'zoom', 'slack', 'github',
]

const RECURRING_HINTS = [
  'mortgage', 'rent', 'loan', 'insurance', 'utility', 'utilities', 'electric', 'water',
  'internet', 'phone', 'mobile', 'daycare', 'tuition', 'lease', 'car payment',
  'auto payment', 'hoa', 'property tax',
]

const CADENCE_WINDOWS: { cadence: Cadence; min: number; max: number }[] = [
  { cadence: 'weekly', min: 5, max: 9 },
  { cadence: 'biweekly', min: 12, max: 17 },
  { cadence: 'monthly', min: 24, max: 40 },
  { cadence: 'quarterly', min: 75, max: 110 },
  { cadence: 'half-yearly', min: 165, max: 200 },
  { cadence: 'annual', min: 330, max: 400 },
]

export function normalizeMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/#\s*\d+\s*$/g, '') // trailing "#1234"
    .replace(/[^a-z0-9\s]/g, ' ') // strip punctuation
    .replace(/\b\d{6,}\b/g, ' ') // long reference-number sequences
    .replace(/\s+/g, ' ')
    .trim()
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function classifyCadence(medianDays: number): Cadence | null {
  const hit = CADENCE_WINDOWS.find((w) => medianDays >= w.min && medianDays <= w.max)
  return hit ? hit.cadence : null
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const msPerDay = 86400000
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay)
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function addMonthsPreserveDay(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDayOfTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDayOfTargetMonth))
  return target.toISOString().slice(0, 10)
}

export function nextDateForCadence(lastDate: string, cadence: Cadence): string {
  switch (cadence) {
    case 'weekly':
      return addDays(lastDate, 7)
    case 'biweekly':
      return addDays(lastDate, 14)
    case 'monthly':
      return addMonthsPreserveDay(lastDate, 1)
    case 'quarterly':
      return addMonthsPreserveDay(lastDate, 3)
    case 'half-yearly':
      return addMonthsPreserveDay(lastDate, 6)
    case 'annual':
      return addMonthsPreserveDay(lastDate, 12)
  }
}

function monthlyEquivalent(amount: number, cadence: Cadence): number {
  switch (cadence) {
    case 'weekly':
      return (amount * 52) / 12
    case 'biweekly':
      return (amount * 26) / 12
    case 'monthly':
      return amount
    case 'quarterly':
      return amount / 3
    case 'half-yearly':
      return amount / 6
    case 'annual':
      return amount / 12
  }
}

function hasSubscriptionHint(normalizedMerchant: string, category: string, tags: string[]): boolean {
  const haystack = `${category} ${tags.join(' ')}`.toLowerCase()
  if (haystack.includes('subscription')) return true
  return SUBSCRIPTION_HINTS.some((hint) => normalizedMerchant.includes(hint))
}

function hasRecurringHint(normalizedMerchant: string, category: string, tags: string[]): boolean {
  const haystack = `${normalizedMerchant} ${category} ${tags.join(' ')}`.toLowerCase()
  return RECURRING_HINTS.some((hint) => haystack.includes(hint))
}

/**
 * Detects recurring/subscription candidates from a single user's own expense
 * transactions. Never auto-confirms -- callers decide what to do with the result
 * (show a "Keep" / "Ignore" suggestion).
 */
export function detectRecurringCandidates(
  transactions: DetectableTransaction[],
  alreadyConfirmedNormalizedMerchants: Set<string>,
  dismissedPatternKeys: Set<string>
): RecurringCandidate[] {
  const groups = new Map<string, DetectableTransaction[]>()
  for (const txn of transactions) {
    const key = normalizeMerchant(txn.merchant)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(txn)
  }

  const candidates: RecurringCandidate[] = []

  for (const [normalizedMerchant, txns] of groups) {
    if (alreadyConfirmedNormalizedMerchants.has(normalizedMerchant)) continue

    const uniqueDates = Array.from(new Set(txns.map((t) => t.date))).sort()
    if (uniqueDates.length < 2) continue

    const intervals: number[] = []
    for (let i = 1; i < uniqueDates.length; i++) {
      intervals.push(daysBetween(uniqueDates[i - 1], uniqueDates[i]))
    }
    const medianInterval = median(intervals)
    const cadence = classifyCadence(medianInterval)
    if (!cadence) continue

    const amounts = txns.map((t) => t.amount)
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const variationPct = avgAmount === 0 ? 0 : ((Math.max(...amounts) - Math.min(...amounts)) / avgAmount) * 100
    const jitterDays = Math.max(...intervals.map((i) => Math.abs(i - medianInterval)))

    const mostRecentTxn = [...txns].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
    const category = mostRecentTxn.category
    const tags = txns.flatMap((t) => t.tags)

    const isSubscription = hasSubscriptionHint(normalizedMerchant, category, tags)
    const isRecurringHint = !isSubscription && hasRecurringHint(normalizedMerchant, category, tags)
    const hasStrongHint = isSubscription || isRecurringHint

    if (hasStrongHint) {
      const limit = isSubscription ? 20 : 35
      if (variationPct > limit) continue
    } else {
      // No strong hint: only surface highly stable, non-weekly/biweekly patterns
      // (protects against routine grocery/shopping trips being misread as recurring).
      const stableCadence =
        cadence === 'monthly' || cadence === 'quarterly' || cadence === 'half-yearly' || cadence === 'annual'
      if (!stableCadence || uniqueDates.length < 3 || variationPct > 3) continue
    }

    const patternKey = `${normalizedMerchant}|${cadence}`
    if (dismissedPatternKeys.has(patternKey)) continue

    const confidence: 'high' | 'likely' =
      uniqueDates.length >= 3 && variationPct <= 12 && jitterDays <= 5 ? 'high' : 'likely'

    candidates.push({
      patternKey,
      merchant: mostRecentTxn.merchant,
      category,
      cadence,
      occurrenceCount: uniqueDates.length,
      confidence,
      averageAmount: avgAmount,
      monthlyEquivalent: monthlyEquivalent(avgAmount, cadence),
      nextDate: nextDateForCadence(uniqueDates[uniqueDates.length - 1], cadence),
      kind: isSubscription ? 'subscription' : 'recurring',
    })
  }

  return candidates.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent)
}
