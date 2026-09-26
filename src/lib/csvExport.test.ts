import { describe, expect, it } from 'vitest'
import { transactionsToCsv, transactionsToCsvRows } from '@/lib/csvExport'
import type { Transaction } from '@/hooks/useTransactions'

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    owner_user_id: 'owner-1',
    date: '2026-09-13',
    merchant: 'Trader Joe\'s',
    category: 'Groceries',
    amount: 42.5,
    type: 'expense',
    account: 'Cash',
    to_account: null,
    remarks: null,
    payment_method: null,
    tags: [],
    receipt: false,
    receipt_document_id: null,
    source: 'manual',
    fingerprint: '2026-09-13|trader joe\'s|42.50|cash',
    created_at: '2026-09-13T00:00:00Z',
    original_currency: null,
    original_amount: null,
    fx_rate: null,
    ...overrides,
  }
}

describe('transactionsToCsvRows', () => {
  it('shapes a transaction into a flat export row, keeping the date as raw ISO', () => {
    const rows = transactionsToCsvRows([makeTransaction({ tags: ['weekly', 'staples'] })])
    expect(rows).toEqual([
      {
        Date: '2026-09-13',
        Merchant: "Trader Joe's",
        Type: 'expense',
        Category: 'Groceries',
        Account: 'Cash',
        'To account': '',
        Amount: 42.5,
        'Payment method': '',
        Remarks: '',
        Tags: 'weekly; staples',
        'Original amount': '',
        'Original currency': '',
        'Exchange rate': '',
      },
    ])
  })

  it('adds an Owner column only when an ownerName resolver is given', () => {
    const withoutOwner = transactionsToCsvRows([makeTransaction()])
    expect(withoutOwner[0].Owner).toBeUndefined()

    const withOwner = transactionsToCsvRows([makeTransaction({ owner_user_id: 'owner-2' })], () => 'QA Tester15')
    expect(withOwner[0].Owner).toBe('QA Tester15')
  })

  it('fills a transfer row\'s To account and leaves category blank', () => {
    const rows = transactionsToCsvRows([
      makeTransaction({ type: 'transfer', category: null, account: 'Cash', to_account: 'Savings' }),
    ])
    expect(rows[0]).toMatchObject({ Type: 'transfer', Category: '', 'To account': 'Savings' })
  })

  it('neutralizes formula-injection payloads in every user-controlled field', () => {
    const rows = transactionsToCsvRows(
      [
        makeTransaction({
          merchant: '=HYPERLINK("http://evil.example","click")',
          remarks: '+1+1',
          category: '-2+3',
          account: '@SUM(1,1)',
          tags: ['\tSHELL("rm -rf /")'],
        }),
      ],
      () => '=cmd|\'/c calc\'!A1'
    )
    expect(rows[0]).toEqual({
      Date: '2026-09-13',
      Merchant: '\'=HYPERLINK("http://evil.example","click")',
      Type: 'expense',
      Category: '\'-2+3',
      Account: '\'@SUM(1,1)',
      'To account': '',
      Amount: 42.5,
      'Payment method': '',
      Remarks: "'+1+1",
      Tags: '\'\tSHELL("rm -rf /")',
      'Original amount': '',
      'Original currency': '',
      'Exchange rate': '',
      Owner: '\'=cmd|\'/c calc\'!A1',
    })
  })

  it('leaves ordinary values that happen to contain (but not start with) a trigger character untouched', () => {
    const rows = transactionsToCsvRows([makeTransaction({ merchant: 'A+B Groceries', remarks: 'cost = a lot' })])
    expect(rows[0].Merchant).toBe('A+B Groceries')
    expect(rows[0].Remarks).toBe('cost = a lot')
  })
})

describe('foreign-currency columns', () => {
  it('fills original amount, currency and rate for a foreign entry', () => {
    const [row] = transactionsToCsvRows([
      makeTransaction({ amount: 2197.51, original_amount: 20, original_currency: 'EUR', fx_rate: 109.8755 }),
    ])
    expect(row).toMatchObject({ Amount: 2197.51, 'Original amount': 20, 'Original currency': 'EUR', 'Exchange rate': 109.8755 })
  })
})

describe('transactionsToCsv', () => {
  it('produces a header row plus one data row per transaction', () => {
    const csv = transactionsToCsv([makeTransaction(), makeTransaction({ id: 't2', merchant: 'Cafe' })])
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe(
      'Date,Merchant,Type,Category,Account,To account,Amount,Payment method,Remarks,Tags,Original amount,Original currency,Exchange rate'
    )
  })
})
