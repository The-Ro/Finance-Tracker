import { describe, expect, it } from 'vitest'
import { findCardPaymentExpenses, toCardPaymentUpdate } from './cardPayments'
import type { Transaction } from '@/hooks/useTransactions'

const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.merchant ?? 'id',
  owner_user_id: 'u1',
  date: '2026-09-25',
  merchant: 'Swiggy',
  category: 'Dining',
  amount: 500,
  type: 'expense',
  account: 'HDFC Bank',
  to_account: null,
  remarks: null,
  payment_method: 'UPI',
  debit_card_id: null,
  tags: [],
  receipt: false,
  receipt_document_id: null,
  source: 'manual',
  fingerprint: 'f',
  created_at: '2026-09-25T00:00:00Z',
  original_currency: null,
  original_amount: null,
  fx_rate: null,
  ...over,
})

const cards = ['HDFC Credit Card', 'ICICI Amazon Pay Card']
const TODAY = '2026-09-27'
const find = (txs: Transaction[], cardList: string[] = cards, bills: Parameters<typeof findCardPaymentExpenses>[2] = []) =>
  findCardPaymentExpenses(txs, cardList, bills, TODAY)

describe('findCardPaymentExpenses', () => {
  it('finds bill payments logged as expenses and suggests the card by name', () => {
    const found = find([
      tx({ merchant: 'HDFC CC payment', amount: 12000 }),
      tx({ merchant: 'Swiggy' }),
      tx({ merchant: 'Credit card bill ICICI', amount: 800 }),
    ])
    expect(found.map((f) => [f.transaction.merchant, f.card])).toEqual([
      ['HDFC CC payment', 'HDFC Credit Card'],
      ['Credit card bill ICICI', 'ICICI Amazon Pay Card'],
    ])
    expect(found[0].reason).toBe('Mentions HDFC Credit Card')
  })

  it('recognises CRED card/bill payments, BillDesk and autopay', () => {
    const found = find([
      tx({ merchant: 'CRED bill payment' }),
      tx({ merchant: 'CRED', remarks: 'HDFC credit card' }),
      tx({ merchant: 'BILLDESK*HDFC CARDS' }),
      tx({ merchant: 'Autopay', remarks: 'card dues' }),
    ])
    expect(found).toHaveLength(4)
  })

  it('ignores CRED payments that are not card bills', () => {
    expect(find([tx({ merchant: 'CRED' }), tx({ merchant: 'CRED rent payment' }), tx({ merchant: 'CRED - school fees' })])).toEqual([])
  })

  it('ignores EMI and offer wording that mentions a credit card', () => {
    expect(
      find([
        tx({ merchant: 'Croma', remarks: 'credit card EMI 3 of 6' }),
        tx({ merchant: 'Amazon', remarks: '10% off with HDFC credit card offer' }),
        tx({ merchant: 'Credit card cashback reversal' }),
      ])
    ).toEqual([])
  })

  it('falls back to a matching bill amount, then to the only card', () => {
    const byAmount = find([tx({ merchant: 'CRED bill payment', amount: 4999.5 })], cards, [
      { account: 'ICICI Amazon Pay Card', due: 5000 },
      { account: 'HDFC Credit Card', due: 12000 },
    ])
    expect(byAmount[0]).toMatchObject({ card: 'ICICI Amazon Pay Card', reason: "Matches ICICI Amazon Pay Card's bill amount" })
    expect(find([tx({ merchant: 'CRED bill payment' })], ['HDFC Credit Card'])[0].card).toBe('HDFC Credit Card')
    expect(find([tx({ merchant: 'CRED bill payment' })])[0].card).toBeNull()
  })

  it('skips a bill that was already paid by a transfer into the card', () => {
    const paid = tx({ merchant: 'HDFC card bill', type: 'transfer', to_account: 'HDFC Credit Card', amount: 12000, date: '2026-09-23' })
    const imported = tx({ merchant: 'HDFC CC payment', amount: 12000, date: '2026-09-25' })
    expect(find([paid, imported])).toEqual([])
    // A transfer into a different card, for another amount, or a week away doesn't count.
    expect(find([{ ...paid, to_account: 'ICICI Amazon Pay Card' }, imported])).toHaveLength(1)
    expect(find([{ ...paid, amount: 9000 }, imported])).toHaveLength(1)
    expect(find([{ ...paid, date: '2026-09-15' }, imported])).toHaveLength(1)
  })

  it('skips an unmatched bill when any card got a transfer for that amount', () => {
    const paid = tx({ merchant: 'Card payment', type: 'transfer', to_account: 'ICICI Amazon Pay Card', amount: 5000, date: '2026-09-24' })
    expect(find([paid, tx({ merchant: 'CRED bill payment', amount: 5000 })])).toEqual([])
  })

  it('only looks at the last 90 days', () => {
    expect(find([tx({ merchant: 'HDFC CC payment', date: '2026-06-29' })])).toHaveLength(1)
    expect(find([tx({ merchant: 'HDFC CC payment', date: '2026-06-28' })])).toEqual([])
  })

  it('never treats a legacy "… Debit Card" account as a credit card to pay', () => {
    const withLegacy = ['HDFC Credit Card', 'SBI Debit Card']
    const found = find([tx({ merchant: 'CRED bill payment' }), tx({ merchant: 'SBI card payment' })], withLegacy)
    expect(found.map((f) => f.card)).toEqual(['HDFC Credit Card', 'HDFC Credit Card'])
    expect(find([tx({ merchant: 'Credit card payment' })], ['SBI Debit Card'])).toEqual([])
  })

  it('skips card spends, income, transfers, fees and debit-card purchases', () => {
    const found = find([
      tx({ merchant: 'Credit card payment', account: 'HDFC Credit Card' }),
      tx({ merchant: 'Credit card payment', type: 'transfer', to_account: 'HDFC Credit Card' }),
      tx({ merchant: 'Credit card refund', type: 'income' }),
      tx({ merchant: 'HDFC credit card annual fee' }),
      tx({ merchant: 'Credit card late payment charges' }),
      tx({ merchant: 'Amazon debit card payment' }),
    ])
    expect(found).toEqual([])
  })

  it('does nothing without credit cards', () => {
    expect(find([tx({ merchant: 'CRED bill payment' })], [])).toEqual([])
  })
})

describe('toCardPaymentUpdate', () => {
  it('turns the expense into a transfer from the same account to the card', () => {
    const t = tx({ merchant: 'HDFC CC payment', amount: 12000, payment_method: 'Net banking', tags: ['bills'] })
    expect(toCardPaymentUpdate(t, 'HDFC Credit Card')).toEqual({
      id: t.id,
      date: t.date,
      merchant: 'HDFC CC payment',
      category: null,
      amount: 12000,
      type: 'transfer',
      account: 'HDFC Bank',
      toAccount: 'HDFC Credit Card',
      remarks: null,
      paymentMethod: 'Net banking',
      debitCardId: null,
      tags: ['bills'],
      foreign: null,
    })
    expect(toCardPaymentUpdate(tx({ payment_method: 'Debit card' }), 'HDFC Credit Card').paymentMethod).toBeNull()
  })
})
