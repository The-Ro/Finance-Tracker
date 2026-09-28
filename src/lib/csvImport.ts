import Papa from 'papaparse'
import { toLocalISODate } from '@/lib/format'

export interface CsvColumnMapping {
  date: string | null
  merchant: string | null
  amount: string | null
  debit: string | null
  credit: string | null
  /** expense/income (or debit/credit, Dr/Cr) per row -- e.g. this app's own export. */
  type: string | null
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

const DEBIT_TERMS = ['debit', 'debits', 'withdrawal', 'withdrawals', 'dr', 'money out', 'paid out']
const CREDIT_TERMS = ['credit', 'credits', 'deposit', 'deposits', 'cr', 'money in', 'paid in']
const AMOUNT_TERMS = ['amount', 'amt', 'value', 'sum']
const MERCHANT_TERMS = ['description', 'merchant', 'payee', 'name', 'details', 'narration', 'particulars', 'memo']

/** Header split into lowercase whole words, space-padded so phrase checks can't match mid-word. */
function headerWords(header: string): string {
  const words = header
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
  return ` ${words.join(' ')} `
}

function hasTerm(words: string, terms: string[]): boolean {
  return terms.some((t) => words.includes(` ${t} `))
}

/**
 * Which field a header most likely is, by whole words and in priority order --
 * substring matching used to map "Value Date" to the amount, "Debit Amount" to
 * a single signed amount (turning every debit into income) and "Account Name"
 * to the merchant.
 */
function classifyHeader(header: string): keyof CsvColumnMapping | null {
  const w = headerWords(header)
  if (hasTerm(w, ['date'])) return 'date'
  if (hasTerm(w, ['balance'])) return null
  if (hasTerm(w, ['category', 'type of expense'])) return 'category'
  if (hasTerm(w, ['account', 'card'])) return 'account'
  const debit = hasTerm(w, DEBIT_TERMS)
  const credit = hasTerm(w, CREDIT_TERMS)
  if ((debit && credit) || hasTerm(w, ['type'])) return 'type'
  if (debit) return 'debit'
  if (credit) return 'credit'
  if (hasTerm(w, AMOUNT_TERMS)) return 'amount'
  if (hasTerm(w, MERCHANT_TERMS)) return 'merchant'
  return null
}

export function detectColumnMapping(headers: string[]): CsvColumnMapping {
  const mapping: CsvColumnMapping = {
    date: null,
    merchant: null,
    amount: null,
    debit: null,
    credit: null,
    type: null,
    category: null,
    account: null,
  }

  // A "Value Date" (settlement date) is only used when there's no transaction date.
  const ordered = [...headers].sort(
    (a, b) => Number(hasTerm(headerWords(a), ['value'])) - Number(hasTerm(headerWords(b), ['value']))
  )
  for (const header of ordered) {
    const field = classifyHeader(header)
    if (field && !mapping[field]) mapping[field] = header
  }

  if (mapping.debit && mapping.credit) mapping.amount = null

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

export type DayMonthOrder = 'mdy' | 'dmy'

const NUMERIC_DATE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/
const DAY_MONTHNAME_YEAR = /^(\d{1,2})[\s\-/.]+([A-Za-z]{3,9})\.?[\s\-/.,]+(\d{2}|\d{4})$/
const MONTHNAME_DAY_YEAR = /^([A-Za-z]{3,9})\.?[\s\-/.]+(\d{1,2})(?:st|nd|rd|th)?,?[\s\-/.]+(\d{2}|\d{4})$/
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function fullYear(y: string): number {
  return y.length === 2 ? 2000 + Number(y) : Number(y)
}

function monthFromName(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1
}

/**
 * Decides day/month order once for the whole file: a file is either US
 * (MM/DD) or day-first (DD/MM), never both. Any row whose first number is >12
 * proves day-first; any whose second is >12 proves month-first. When every
 * row is ambiguous (both <=12) there's no signal, so MM/DD stays the default.
 */
export function detectDayMonthOrder(values: string[]): DayMonthOrder {
  let dmy = 0
  let mdy = 0
  for (const v of values) {
    const m = v?.trim().match(NUMERIC_DATE)
    if (!m) continue
    const a = Number(m[1])
    const b = Number(m[2])
    if (a > 12 && b <= 12) dmy++
    else if (b > 12 && a <= 12) mdy++
  }
  return dmy > mdy ? 'dmy' : 'mdy'
}

function isoIfValid(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** A real calendar date as ISO, or null (unparseable, or impossible like Feb 30). */
function normalizeDate(raw: string, order: DayMonthOrder): string | null {
  const trimmed = raw.trim()
  const yearFirst = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
  if (yearFirst) return isoIfValid(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]))

  const numeric = trimmed.match(NUMERIC_DATE)
  if (numeric) {
    const [, a, b, y] = numeric
    return order === 'dmy'
      ? isoIfValid(fullYear(y), Number(b), Number(a))
      : isoIfValid(fullYear(y), Number(a), Number(b))
  }

  // "05-Mar-26", "5 March 2026", "Mar 5, 26" -- common in bank exports, and
  // a two-digit year is one new Date() can't be trusted with.
  const dmy = trimmed.match(DAY_MONTHNAME_YEAR)
  if (dmy && monthFromName(dmy[2]) > 0) return isoIfValid(fullYear(dmy[3]), monthFromName(dmy[2]), Number(dmy[1]))
  const mdy = trimmed.match(MONTHNAME_DAY_YEAR)
  if (mdy && monthFromName(mdy[1]) > 0) return isoIfValid(fullYear(mdy[3]), monthFromName(mdy[1]), Number(mdy[2]))

  // Text dates ("5 Mar 2026", "March 5, 2026"). JS parses a date-only string
  // like this as local midnight, so it's read back through local fields --
  // toISOString() would convert to UTC and could shift it by a day. JS also
  // rolls "30 Feb" over into March and invents a year for "Mar 5", so a year
  // must be present and the parsed day must be one of the numbers written.
  if (!/\b\d{4}\b/.test(trimmed)) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  const numbers = (trimmed.match(/\d+/g) ?? []).map(Number)
  if (!numbers.includes(parsed.getDate())) return null
  return toLocalISODate(parsed)
}

/** Strips currency symbols/codes, treats a parenthesized amount, a minus
 *  before or after the number (ASCII or Unicode −) and a "DR" marker as
 *  negative, and disambiguates US (1,234.56) vs European (1.234,56)
 *  separators by treating whichever of '.'/',' appears LAST as the decimal
 *  point; a lone comma with 1-2 digits after it ("12,5") is a decimal too.
 *  Returns NaN if nothing numeric-looking is left. */
export function parseAmount(raw: string): number {
  let s = raw.trim().replace(/−/g, '-')
  if (!s) return NaN

  let negative = false
  const parenMatch = s.match(/^\((.+)\)$/)
  if (parenMatch) {
    negative = true
    s = parenMatch[1].trim()
  }

  const suffix = s.match(/(dr|cr)\.?$/i)
  if (suffix && suffix.index !== undefined && (suffix.index === 0 || !/\p{L}/u.test(s[suffix.index - 1]))) {
    if (suffix[1].toLowerCase() === 'dr') negative = true
    s = s.slice(0, suffix.index).trim()
  }
  const prefix = s.match(/^(dr|cr)\.?(?!\p{L})/iu)
  if (prefix) {
    if (prefix[1].toLowerCase() === 'dr') negative = true
    s = s.slice(prefix[0].length).trim()
  }

  const firstDigit = s.search(/\d/)
  if (firstDigit === -1) return NaN
  // Letters between digit groups ("01 Mar 2026") means this isn't an amount.
  if (/\d[^\d]*\p{L}[^\d]*\d/u.test(s)) return NaN
  if (s.slice(0, firstDigit).includes('-') || /-\s*$/.test(s)) negative = true

  s = s.replace(/[^0-9.,]/g, '')

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot !== -1 && lastComma !== -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma !== -1) {
    const commaCount = s.split(',').length - 1
    const digitsAfter = s.length - lastComma - 1
    s = commaCount === 1 && (digitsAfter === 1 || digitsAfter === 2) ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (lastDot !== -1 && s.indexOf('.') !== lastDot) {
    // "1.234.567" -- more than one dot can only be thousands separators.
    s = s.replace(/\./g, '')
  }

  const num = Number(s)
  if (!Number.isFinite(num)) return NaN
  return negative ? -num : num
}

type RowType = 'expense' | 'income' | 'transfer'

const EXPENSE_TYPES = new Set(['expense', 'debit', 'dr', 'd', 'withdrawal', 'moneyout', 'out'])
const INCOME_TYPES = new Set(['income', 'credit', 'cr', 'c', 'deposit', 'moneyin', 'in'])

function parseRowType(raw: string | undefined): RowType | null {
  const v = (raw ?? '').trim().toLowerCase().replace(/[^a-z]/g, '')
  if (!v) return null
  if (v === 'transfer') return 'transfer'
  if (EXPENSE_TYPES.has(v)) return 'expense'
  if (INCOME_TYPES.has(v)) return 'income'
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
  /** Every row not imported, including the two breakdowns below. */
  skipped: number
  /** Rows whose date was present but isn't a real calendar date (e.g. 31/02/2026). */
  invalidDates: number
  /** Transfer rows (e.g. from this app's own export) -- import only brings in expenses and income. */
  transfers: number
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
  const dateColumn = mapping.date
  const order = detectDayMonthOrder(dateColumn ? rows.map((r) => r[dateColumn] ?? '') : [])
  const ok: NormalizedCsvRow[] = []
  let skipped = 0
  let invalidDates = 0
  let transfers = 0

  const fromAmountColumn = (row: Record<string, string>, typeHint: RowType | null) => {
    if (!mapping.amount) return null
    const raw = row[mapping.amount]?.trim()
    const num = raw ? parseAmount(raw) : NaN
    if (!Number.isFinite(num) || num === 0) return null
    const type: 'expense' | 'income' =
      typeHint === 'expense' || typeHint === 'income' ? typeHint : num < 0 ? 'expense' : 'income'
    return { amount: Math.abs(num), type }
  }

  const fromDebitCredit = (row: Record<string, string>) => {
    const debitRaw = mapping.debit ? row[mapping.debit]?.trim() : ''
    const creditRaw = mapping.credit ? row[mapping.credit]?.trim() : ''
    const debit = debitRaw ? parseAmount(debitRaw) : NaN
    const credit = creditRaw ? parseAmount(creditRaw) : NaN
    // Some banks write debits as negatives in the Debit column -- still a debit.
    if (Number.isFinite(debit) && debit !== 0) return { amount: Math.abs(debit), type: 'expense' as const }
    if (Number.isFinite(credit) && credit !== 0) return { amount: Math.abs(credit), type: 'income' as const }
    return null
  }

  const preferDebitCredit = !!mapping.debit && !!mapping.credit

  for (const row of rows) {
    const dateRaw = dateColumn ? row[dateColumn]?.trim() : ''
    const merchantRaw = mapping.merchant ? row[mapping.merchant] : ''
    const date = dateRaw ? normalizeDate(dateRaw, order) : null
    const merchant = merchantRaw?.trim()

    if (dateRaw && !date) invalidDates++
    if (!date || !merchant) {
      skipped++
      continue
    }

    const typeHint = mapping.type ? parseRowType(row[mapping.type]) : null
    if (typeHint === 'transfer') {
      transfers++
      skipped++
      continue
    }

    const parsed = preferDebitCredit
      ? (fromDebitCredit(row) ?? fromAmountColumn(row, typeHint))
      : (fromAmountColumn(row, typeHint) ?? fromDebitCredit(row))

    if (!parsed || !Number.isFinite(parsed.amount) || parsed.amount <= 0) {
      skipped++
      continue
    }

    const rawCategory = mapping.category ? row[mapping.category]?.trim() : ''
    const category = (rawCategory && categoryLookup.get(rawCategory.toLowerCase())) || 'Needs review'

    const rawAccount = mapping.account ? row[mapping.account]?.trim() : ''
    const account = (rawAccount && accountLookup.get(rawAccount.toLowerCase())) || fallbackAccount

    ok.push({ date, merchant, amount: parsed.amount, type: parsed.type, category, account })
  }

  return { ok, skipped, invalidDates, transfers }
}
