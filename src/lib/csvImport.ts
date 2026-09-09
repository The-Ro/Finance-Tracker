import Papa from 'papaparse'
import { toLocalISODate } from '@/lib/format'

export interface CsvColumnMapping {
  date: string | null
  merchant: string | null
  amount: string | null
  debit: string | null
  credit: string | null
  category: string | null
  account: string | null
}

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({ headers: results.meta.fields ?? [], rows: results.data })
      },
      error: (err) => reject(err),
    })
  })
}

const HEADER_HINTS: Record<keyof CsvColumnMapping, string[]> = {
  date: ['date', 'transaction date', 'posted date'],
  merchant: ['description', 'merchant', 'payee', 'name', 'details'],
  amount: ['amount', 'value'],
  debit: ['debit', 'withdrawal', 'money out'],
  credit: ['credit', 'deposit', 'money in'],
  category: ['category', 'type of expense'],
  account: ['account', 'account name', 'card'],
}

export function detectColumnMapping(headers: string[]): CsvColumnMapping {
  const mapping: CsvColumnMapping = {
    date: null,
    merchant: null,
    amount: null,
    debit: null,
    credit: null,
    category: null,
    account: null,
  }

  const lowerHeaders = headers.map((h) => ({ raw: h, lower: h.trim().toLowerCase() }))

  for (const key of Object.keys(HEADER_HINTS) as (keyof CsvColumnMapping)[]) {
    const hints = HEADER_HINTS[key]
    const match = lowerHeaders.find((h) => hints.some((hint) => h.lower === hint || h.lower.includes(hint)))
    if (match) mapping[key] = match.raw
  }

  return mapping
}

/** Ambiguous when we can't tell how the amount sign/columns map to expense vs income. */
export function isMappingAmbiguous(mapping: CsvColumnMapping): boolean {
  const hasSingleAmount = !!mapping.amount
  const hasDebitCredit = !!mapping.debit || !!mapping.credit
  if (!mapping.date || !mapping.merchant) return true
  if (!hasSingleAmount && !hasDebitCredit) return true
  return false
}

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim()
  // Already ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // MM/DD/YYYY or M/D/YYYY (most common US bank export format).
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, mm, dd, yyyy] = slashMatch
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  // JS parses a non-ISO date-only string like "January 5, 2026" as local
  // midnight, so pulling it back out has to read the same Date object's
  // local fields -- toISOString() would convert to UTC first and could
  // shift the date by a day depending on the importing user's timezone.
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return toLocalISODate(parsed)
  return null
}

export interface NormalizedCsvRow {
  date: string
  merchant: string
  amount: number
  type: 'expense' | 'income'
  category: string
  account: string
}

export interface CsvNormalizeResult {
  ok: NormalizedCsvRow[]
  skipped: number
}

export function normalizeCsvRows(
  rows: Record<string, string>[],
  mapping: CsvColumnMapping,
  fallbackAccount: string,
  knownCategories: string[] = [],
  knownAccounts: string[] = []
): CsvNormalizeResult {
  const categoryLookup = new Map(knownCategories.map((c) => [c.toLowerCase(), c]))
  const accountLookup = new Map(knownAccounts.map((a) => [a.toLowerCase(), a]))
  const ok: NormalizedCsvRow[] = []
  let skipped = 0

  for (const row of rows) {
    const dateRaw = mapping.date ? row[mapping.date] : ''
    const merchantRaw = mapping.merchant ? row[mapping.merchant] : ''
    const date = dateRaw ? normalizeDate(dateRaw) : null
    const merchant = merchantRaw?.trim()

    if (!date || !merchant) {
      skipped++
      continue
    }

    let amount: number | null = null
    let type: 'expense' | 'income' | null = null

    if (mapping.amount) {
      const raw = row[mapping.amount]?.replace(/[$,]/g, '').trim()
      const num = raw ? Number(raw) : NaN
      if (!Number.isFinite(num) || num === 0) {
        skipped++
        continue
      }
      amount = Math.abs(num)
      type = num < 0 ? 'expense' : 'income'
    } else {
      const debitRaw = mapping.debit ? row[mapping.debit]?.replace(/[$,]/g, '').trim() : ''
      const creditRaw = mapping.credit ? row[mapping.credit]?.replace(/[$,]/g, '').trim() : ''
      const debit = debitRaw ? Number(debitRaw) : NaN
      const credit = creditRaw ? Number(creditRaw) : NaN

      if (Number.isFinite(debit) && debit > 0) {
        amount = Math.abs(debit)
        type = 'expense'
      } else if (Number.isFinite(credit) && credit > 0) {
        amount = Math.abs(credit)
        type = 'income'
      } else {
        skipped++
        continue
      }
    }

    if (amount === null || type === null || !Number.isFinite(amount) || amount <= 0) {
      skipped++
      continue
    }

    const rawCategory = mapping.category ? row[mapping.category]?.trim() : ''
    const category = (rawCategory && categoryLookup.get(rawCategory.toLowerCase())) || 'Needs review'

    const rawAccount = mapping.account ? row[mapping.account]?.trim() : ''
    const account = (rawAccount && accountLookup.get(rawAccount.toLowerCase())) || fallbackAccount

    ok.push({ date, merchant, amount, type, category, account })
  }

  return { ok, skipped }
}
