import { describe, expect, it } from 'vitest'
import {
  EMPTY_TRANSACTION_FILTERS,
  buildSearchOrFilter,
  escapeLike,
  hasActiveFilters,
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
