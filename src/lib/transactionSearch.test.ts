import { describe, expect, it } from 'vitest'
import {
  DEBIT_CARD_FILTER_PREFIX,
  EMPTY_TRANSACTION_FILTERS,
  buildSearchOrFilter,
  escapeLike,
  hasActiveFilters,
  matchesFilters,
  quotePostgrestValue,
} from '@/lib/transactionSearch'

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character itself', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\')
  })
})

describe('quotePostgrestValue', () => {
  it('wraps in quotes and escapes embedded quotes and backslashes', () => {
    expect(quotePostgrestValue('a"b\\c')).toBe('"a\\"b\\\\c"')
  })
})

describe('buildSearchOrFilter', () => {
  it('returns null for empty or whitespace-only input', () => {
    expect(buildSearchOrFilter('')).toBeNull()
    expect(buildSearchOrFilter('   ')).toBeNull()
  })

  it('builds a merchant/category ilike plus exact tag match', () => {
    expect(buildSearchOrFilter(' coffee ')).toBe(
      'merchant.ilike."%coffee%",category.ilike."%coffee%",tags.cs."{\\"coffee\\"}"'
    )
  })

  it('keeps commas and parentheses inside the quoted value so they cannot break out of the or() list', () => {
    const filter = buildSearchOrFilter('a,b)c')!
    expect(filter.startsWith('merchant.ilike."%a,b)c%",')).toBe(true)
    // exactly three top-level clauses -- the user's comma did not create a fourth
    expect(filter.split(/,(?=(?:merchant|category|tags)\.)/)).toHaveLength(3)
  })

  it('escapes LIKE wildcards in the search text', () => {
    expect(buildSearchOrFilter('50%')).toContain('merchant.ilike."%50\\\\%%"')
  })
})

describe('hasActiveFilters', () => {
  it('is false for the empty filters and true once anything is set', () => {
    expect(hasActiveFilters(EMPTY_TRANSACTION_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_TRANSACTION_FILTERS, search: ' x ' })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_TRANSACTION_FILTERS, category: 'Dining' })).toBe(true)
  })
})

describe('matchesFilters', () => {
  const t = {
    merchant: 'Swiggy Instamart',
    category: 'Groceries',
    tags: ['weekly'],
    type: 'expense' as const,
    account: 'HDFC Bank',
    payment_method: 'UPI',
    debit_card_id: 'card-1',
    owner_user_id: 'me',
  }
  const f = { ...EMPTY_TRANSACTION_FILTERS }
  it('matches everything with no filters', () => {
    expect(matchesFilters(t, f)).toBe(true)
  })
  it('searches merchant and category in any case, tags exactly', () => {
    expect(matchesFilters(t, { ...f, search: 'instamart' })).toBe(true)
    expect(matchesFilters(t, { ...f, search: 'GROC' })).toBe(true)
    expect(matchesFilters(t, { ...f, search: 'weekly' })).toBe(true)
    expect(matchesFilters(t, { ...f, search: 'Week' })).toBe(false)
  })
  it('narrows by category, mode, person and account or debit card', () => {
    expect(matchesFilters(t, { ...f, category: 'Dining' })).toBe(false)
    expect(matchesFilters(t, { ...f, paymentMethod: 'Cash' })).toBe(false)
    expect(matchesFilters(t, { ...f, ownerId: 'someone' })).toBe(false)
    expect(matchesFilters(t, { ...f, account: 'HDFC Bank' })).toBe(true)
    expect(matchesFilters(t, { ...f, account: DEBIT_CARD_FILTER_PREFIX + 'card-1' })).toBe(true)
    expect(matchesFilters(t, { ...f, account: DEBIT_CARD_FILTER_PREFIX + 'card-2' })).toBe(false)
  })
  it('can leave the type filter out', () => {
    expect(matchesFilters(t, { ...f, type: 'income' })).toBe(false)
    expect(matchesFilters(t, { ...f, type: 'income' }, { ignoreType: true })).toBe(true)
  })
})
