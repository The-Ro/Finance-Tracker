import { describe, expect, it } from 'vitest'
import { addSavedFilter, describeFilters, isSaved, MAX_SAVED_FILTERS } from './savedFilters'
import { EMPTY_TRANSACTION_FILTERS } from './transactionSearch'

const dining = { ...EMPTY_TRANSACTION_FILTERS, type: 'expense' as const, category: 'Dining', search: ' uber ' }

describe('savedFilters', () => {
  it('describes a filter set', () => {
    expect(describeFilters(dining)).toBe('Expenses · Dining · "uber"')
    expect(describeFilters(EMPTY_TRANSACTION_FILTERS)).toBe('All transactions')
  })
  it('dedupes, trims and caps', () => {
    let list = addSavedFilter([], dining)
    list = addSavedFilter(list, { ...dining, search: 'uber' })
    expect(list).toHaveLength(1)
    expect(isSaved(list, { ...dining, search: 'uber' })).toBe(true)
    for (let i = 0; i < 12; i++) list = addSavedFilter(list, { ...EMPTY_TRANSACTION_FILTERS, search: `s${i}` })
    expect(list).toHaveLength(MAX_SAVED_FILTERS)
    expect(list[0].search).toBe('s11')
  })
})
