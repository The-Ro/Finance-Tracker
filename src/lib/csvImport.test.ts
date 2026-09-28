import { describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import { detectColumnMapping, detectDayMonthOrder, normalizeCsvRows, parseAmount } from '@/lib/csvImport'
import { transactionsToCsv } from '@/lib/csvExport'
import type { Transaction } from '@/hooks/useTransactions'

describe('CSV import helpers', () => {
  it('recognizes common headers and normalizes signed amounts', () => {
    const mapping = detectColumnMapping(['Posted Date', 'Description', 'Amount', 'Account Name', 'Category'])
    const result = normalizeCsvRows(
      [
        { 'Posted Date': '09/13/2026', Description: 'Grocer', Amount: '-1,250.50', 'Account Name': 'cash', Category: 'groceries' },
        { 'Posted Date': '09/14/2026', Description: 'Salary', Amount: '5000', 'Account Name': 'Unknown', Category: '' },
        { 'Posted Date': '', Description: 'Invalid', Amount: '10', 'Account Name': 'Cash', Category: '' },
      ],
      mapping,
      'Cash',
      ['Groceries', 'Needs review'],
      ['Cash']
    )

    expect(result).toEqual({
      ok: [
        { date: '2026-09-13', merchant: 'Grocer', amount: 1250.5, type: 'expense', category: 'Groceries', account: 'Cash' },
        { date: '2026-09-14', merchant: 'Salary', amount: 5000, type: 'income', category: 'Needs review', account: 'Cash' },
      ],
      skipped: 1,
      invalidDates: 0,
      transfers: 0,
    })
  })

  it('handles non-$ currency symbols, parenthesized negatives, European separators, and unambiguous day-first dates', () => {
    const mapping = detectColumnMapping(['Date', 'Description', 'Amount', 'Account', 'Category'])
    const result = normalizeCsvRows(
      [
        { Date: '2026-09-01', Description: 'Rupee credit', Amount: '₹1,234.56', Account: 'Cash', Category: '' },
        { Date: '2026-09-02', Description: 'Parenthesized debit', Amount: '(45.00)', Account: 'Cash', Category: '' },
        { Date: '2026-09-03', Description: 'Euro-style debit', Amount: '-€1.234,56', Account: 'Cash', Category: '' },
        { Date: '25/12/2026', Description: 'Day-first date', Amount: '£10', Account: 'Cash', Category: '' },
      ],
      mapping,
      'Cash',
      ['Needs review'],
      ['Cash']
    )

    expect(result).toEqual({
      ok: [
        { date: '2026-09-01', merchant: 'Rupee credit', amount: 1234.56, type: 'income', category: 'Needs review', account: 'Cash' },
        { date: '2026-09-02', merchant: 'Parenthesized debit', amount: 45, type: 'expense', category: 'Needs review', account: 'Cash' },
        { date: '2026-09-03', merchant: 'Euro-style debit', amount: 1234.56, type: 'expense', category: 'Needs review', account: 'Cash' },
        { date: '2026-12-25', merchant: 'Day-first date', amount: 10, type: 'income', category: 'Needs review', account: 'Cash' },
      ],
      skipped: 0,
      invalidDates: 0,
      transfers: 0,
    })
  })
})

describe('detectColumnMapping', () => {
  it('does not treat "Value Date" as the amount, and prefers the transaction date', () => {
    const mapping = detectColumnMapping(['Txn Date', 'Value Date', 'Description', 'Debit', 'Credit'])
    expect(mapping).toMatchObject({ date: 'Txn Date', merchant: 'Description', amount: null, debit: 'Debit', credit: 'Credit' })

    const result = normalizeCsvRows(
      [{ 'Txn Date': '01 Mar 2026', 'Value Date': '01 Mar 2026', Description: 'ATM', Debit: '500.00', Credit: '' }],
      mapping,
      'Bank'
    )
    expect(result.ok).toEqual([
      { date: '2026-03-01', merchant: 'ATM', amount: 500, type: 'expense', category: 'Needs review', account: 'Bank' },
    ])
  })

  it('maps "Debit Amount"/"Credit Amount" to the debit/credit pair, not a single signed amount', () => {
    const mapping = detectColumnMapping(['Date', 'Description', 'Debit Amount', 'Credit Amount', 'Balance Amount'])
    expect(mapping).toMatchObject({ amount: null, debit: 'Debit Amount', credit: 'Credit Amount' })

    const result = normalizeCsvRows(
      [
        { Date: '2026-03-01', Description: 'Rent', 'Debit Amount': '1000', 'Credit Amount': '', 'Balance Amount': '9000' },
        { Date: '2026-03-02', Description: 'Salary', 'Debit Amount': '', 'Credit Amount': '5000', 'Balance Amount': '14000' },
      ],
      mapping,
      'Bank'
    )
    expect(result.ok.map((r) => [r.merchant, r.type, r.amount])).toEqual([
      ['Rent', 'expense', 1000],
      ['Salary', 'income', 5000],
    ])
  })

  it('maps "Account Name" to the account, not the merchant', () => {
    const mapping = detectColumnMapping(['Account Name', 'Description', 'Date', 'Amount'])
    expect(mapping).toMatchObject({ account: 'Account Name', merchant: 'Description' })
  })

  it('prefers a debit/credit pair over a single amount column when both exist', () => {
    const mapping = detectColumnMapping(['Date', 'Narration', 'Amount', 'Withdrawal Amt.', 'Deposit Amt.'])
    expect(mapping).toMatchObject({ merchant: 'Narration', amount: null, debit: 'Withdrawal Amt.', credit: 'Deposit Amt.' })

    const both = {
      date: 'Date',
      merchant: 'Narration',
      amount: 'Amount',
      debit: 'Withdrawal Amt.',
      credit: 'Deposit Amt.',
      type: null,
      category: null,
      account: null,
    }
    const result = normalizeCsvRows(
      [{ Date: '2026-03-01', Narration: 'Shop', Amount: '45', 'Withdrawal Amt.': '45', 'Deposit Amt.': '' }],
      both,
      'Bank'
    )
    expect(result.ok[0]).toMatchObject({ type: 'expense', amount: 45 })
  })
})

describe('day/month order', () => {
  it('is decided once per file, not row by row', () => {
    expect(detectDayMonthOrder(['05/03/2026', '12/03/2026', '15/03/2026', '28/03/2026'])).toBe('dmy')
    expect(detectDayMonthOrder(['03/05/2026', '03/15/2026'])).toBe('mdy')
    expect(detectDayMonthOrder(['03/04/2026', '05/06/2026'])).toBe('mdy')

    const mapping = detectColumnMapping(['Date', 'Description', 'Amount'])
    const result = normalizeCsvRows(
      ['05/03/2026', '12/03/2026', '15/03/2026', '28/03/2026'].map((Date) => ({ Date, Description: 'x', Amount: '-1' })),
      mapping,
      'Cash'
    )
    expect(result.ok.map((r) => r.date)).toEqual(['2026-03-05', '2026-03-12', '2026-03-15', '2026-03-28'])
  })

  it('rejects impossible dates one row at a time instead of failing the batch', () => {
    const mapping = detectColumnMapping(['Date', 'Description', 'Amount'])
    const result = normalizeCsvRows(
      [
        { Date: '2026-02-30', Description: 'a', Amount: '-1' },
        { Date: '31/02/2026', Description: 'b', Amount: '-1' },
        { Date: '13/13/2026', Description: 'c', Amount: '-1' },
        { Date: '30 Feb 2026', Description: 'd', Amount: '-1' },
        { Date: '2026-02-28', Description: 'e', Amount: '-1' },
      ],
      mapping,
      'Cash'
    )
    expect(result.ok.map((r) => r.merchant)).toEqual(['e'])
    expect(result.invalidDates).toBe(4)
    expect(result.skipped).toBe(4)
  })

  it('reads two-digit years as 20yy, with numeric or month-name dates', () => {
    expect(detectDayMonthOrder(['25/03/26', '05/03/26'])).toBe('dmy')

    const mapping = detectColumnMapping(['Date', 'Description', 'Amount'])
    const dates = ['25/03/26', '05/03/26', '05-Mar-26', '5 March 2026', 'Mar 5, 26', '31-Feb-26']
    const result = normalizeCsvRows(
      dates.map((Date) => ({ Date, Description: 'x', Amount: '-1' })),
      mapping,
      'Cash'
    )
    expect(result.ok.map((r) => r.date)).toEqual(['2026-03-25', '2026-03-05', '2026-03-05', '2026-03-05', '2026-03-05'])
    expect(result.invalidDates).toBe(1)
  })
})

describe('parseAmount', () => {
  it('keeps the sign for trailing minus, Unicode minus and DR/CR markers', () => {
    expect(parseAmount('45.00-')).toBe(-45)
    expect(parseAmount('−45.00')).toBe(-45)
    expect(parseAmount('45.00 DR')).toBe(-45)
    expect(parseAmount('45.00Dr')).toBe(-45)
    expect(parseAmount('Dr. 45.00')).toBe(-45)
    expect(parseAmount('45.00 CR')).toBe(45)
    expect(parseAmount('₹-45')).toBe(-45)
  })

  it('reads a lone comma followed by 1-2 digits as a decimal point', () => {
    expect(parseAmount('12,5')).toBe(12.5)
    expect(parseAmount('12,50')).toBe(12.5)
    expect(parseAmount('1,234')).toBe(1234)
    expect(parseAmount('1,23,456')).toBe(123456)
    expect(parseAmount('1.234.567')).toBe(1234567)
  })

  it('rejects a date that ended up in the amount column', () => {
    expect(parseAmount('01 Mar 2026')).toBeNaN()
    expect(parseAmount('INR 1,200.00')).toBe(1200)
  })
})

describe('debit/credit columns', () => {
  it('treats a negative number in the Debit column as a debit, not a skipped row', () => {
    const mapping = detectColumnMapping(['Date', 'Description', 'Debit', 'Credit'])
    const result = normalizeCsvRows([{ Date: '2026-03-01', Description: 'Shop', Debit: '-45.00', Credit: '' }], mapping, 'Bank')
    expect(result.ok).toEqual([
      { date: '2026-03-01', merchant: 'Shop', amount: 45, type: 'expense', category: 'Needs review', account: 'Bank' },
    ])
  })
})

describe("re-importing this app's own export", () => {
  const base: Transaction = {
    id: 't1',
    owner_user_id: 'owner-1',
    date: '2026-09-13',
    merchant: 'Coffee',
    category: 'Dining',
    amount: 4.5,
    type: 'expense',
    account: 'Cash',
    to_account: null,
    remarks: null,
    payment_method: null,
    debit_card_id: null,
    tags: [],
    receipt: false,
    receipt_document_id: null,
    source: 'manual',
    fingerprint: 'x',
    created_at: '2026-09-13T00:00:00Z',
    original_currency: null,
    original_amount: null,
    fx_rate: null,
  }

  it('keeps expenses as expenses and skips transfers', () => {
    const csv = transactionsToCsv([
      base,
      { ...base, id: 't2', merchant: 'Salary', category: 'Salary', amount: 1000, type: 'income' },
      { ...base, id: 't3', merchant: 'To savings', category: null, amount: 200, type: 'transfer', to_account: 'Savings' },
    ])
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true })
    const mapping = detectColumnMapping(parsed.meta.fields ?? [])
    expect(mapping).toMatchObject({ amount: 'Amount', type: 'Type', account: 'Account', merchant: 'Merchant' })

    const result = normalizeCsvRows(parsed.data, mapping, 'Cash', ['Dining', 'Salary'], ['Cash', 'Savings'])
    expect(result.ok.map((r) => [r.merchant, r.type, r.amount, r.category])).toEqual([
      ['Coffee', 'expense', 4.5, 'Dining'],
      ['Salary', 'income', 1000, 'Salary'],
    ])
    expect(result.transfers).toBe(1)
    expect(result.skipped).toBe(1)
  })

  it('honours a Dr/Cr indicator column next to an unsigned amount', () => {
    const mapping = detectColumnMapping(['Date', 'Particulars', 'Amount', 'Dr/Cr'])
    expect(mapping).toMatchObject({ merchant: 'Particulars', amount: 'Amount', type: 'Dr/Cr' })
    const result = normalizeCsvRows(
      [
        { Date: '2026-03-01', Particulars: 'Shop', Amount: '45', 'Dr/Cr': 'Dr' },
        { Date: '2026-03-02', Particulars: 'Refund', Amount: '45', 'Dr/Cr': 'CR' },
      ],
      mapping,
      'Bank'
    )
    expect(result.ok.map((r) => r.type)).toEqual(['expense', 'income'])
  })
})
