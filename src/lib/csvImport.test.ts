import { describe, expect, it } from 'vitest'
import { detectColumnMapping, normalizeCsvRows } from '@/lib/csvImport'

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
    })
  })
})
