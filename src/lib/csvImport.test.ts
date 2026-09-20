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
})
