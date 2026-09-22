import Papa from 'papaparse'
import type { Transaction } from '@/hooks/useTransactions'

// CSV formula injection: a merchant/category/account/remarks/tag/owner-name
// value is arbitrary user-controlled text (including from another user's
// transactions, if this is a shared "Everyone" export) -- if it starts with
// =, +, -, @, or a tab/CR, Excel/Sheets/LibreOffice can interpret the whole
// cell as a formula when the exported file is opened, up to running a
// DDE/shell command via =cmd|'/c ...'!A1-style payloads. Prefixing such a
// value with a plain single quote forces every spreadsheet app to treat it
// as literal text instead, without changing how it displays in the app
// itself (this only ever touches the exported CSV, not the stored value).
const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r'])
function sanitizeCsvField(value: string): string {
  return value.length > 0 && FORMULA_TRIGGER_CHARS.has(value[0]) ? `'${value}` : value
}

export interface CsvExportRow {
  Date: string
  Merchant: string
  Type: string
  Category: string
  Account: string
  'To account': string
  Amount: number
  'Payment method': string
  Remarks: string
  Tags: string
  Owner?: string
}

/**
 * Shapes transactions into export rows. `date` is kept as its raw ISO
 * (YYYY-MM-DD) form rather than a locale-formatted string -- unambiguous,
 * sorts correctly in a spreadsheet, and re-importable through this app's own
 * CSV import (normalizeDate in csvImport.ts accepts ISO directly).
 *
 * `ownerName`, when given, adds an "Owner" column by resolving each row's
 * owner_user_id -- only meaningful for the "Everyone" (shared) scope, so
 * TransactionsPage only passes it there.
 */
export function transactionsToCsvRows(
  transactions: Transaction[],
  ownerName?: (ownerUserId: string) => string
): CsvExportRow[] {
  return transactions.map((t) => {
    const row: CsvExportRow = {
      Date: t.date,
      Merchant: sanitizeCsvField(t.merchant),
      Type: t.type,
      Category: sanitizeCsvField(t.category ?? ''),
      Account: sanitizeCsvField(t.account),
      'To account': sanitizeCsvField(t.to_account ?? ''),
      Amount: t.amount,
      'Payment method': sanitizeCsvField(t.payment_method ?? ''),
      Remarks: sanitizeCsvField(t.remarks ?? ''),
      Tags: sanitizeCsvField(t.tags.join('; ')),
    }
    if (ownerName) row.Owner = sanitizeCsvField(ownerName(t.owner_user_id))
    return row
  })
}

export function transactionsToCsv(transactions: Transaction[], ownerName?: (ownerUserId: string) => string): string {
  return Papa.unparse(transactionsToCsvRows(transactions, ownerName))
}

/** Triggers a browser download of `csv` as a file named `filename` -- a
 *  transient object URL + anchor click, revoked right after. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
