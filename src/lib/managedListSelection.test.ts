import { describe, expect, it } from 'vitest'
import {
  CHIP_EXIT_MS,
  CHIP_EXIT_MAX_STAGGER_STEPS,
  CHIP_EXIT_STAGGER_MS,
  exitDelayMs,
  exitTotalMs,
  formatNameList,
  pruneSelected,
  selectedInOrder,
  summarizeRemoval,
  toggleSelected,
} from '@/lib/managedListSelection'

describe('toggleSelected', () => {
  it('adds a missing name and removes a present one without mutating the input', () => {
    const start = new Set(['Food'])
    const added = toggleSelected(start, 'Rent')
    expect([...added]).toEqual(['Food', 'Rent'])
    const removed = toggleSelected(added, 'Food')
    expect([...removed]).toEqual(['Rent'])
    expect([...start]).toEqual(['Food'])
  })
})

describe('pruneSelected / selectedInOrder', () => {
  it('drops names that left the list', () => {
    expect([...pruneSelected(new Set(['Food', 'Gone']), ['Food', 'Rent'])]).toEqual(['Food'])
  })

  it('returns selected names in list order, not click order', () => {
    const selected = new Set(['Travel', 'Food'])
    expect(selectedInOrder(selected, ['Food', 'Rent', 'Travel'])).toEqual(['Food', 'Travel'])
  })
})

describe('exit timing', () => {
  it('staggers chips and caps the stagger', () => {
    expect(exitDelayMs(0)).toBe(0)
    expect(exitDelayMs(2)).toBe(2 * CHIP_EXIT_STAGGER_MS)
    expect(exitDelayMs(100)).toBe(CHIP_EXIT_MAX_STAGGER_STEPS * CHIP_EXIT_STAGGER_MS)
    expect(exitDelayMs(-1)).toBe(0)
  })

  it('totals the last chip delay plus one exit', () => {
    expect(exitTotalMs(0)).toBe(0)
    expect(exitTotalMs(1)).toBe(CHIP_EXIT_MS)
    expect(exitTotalMs(3)).toBe(CHIP_EXIT_MS + 2 * CHIP_EXIT_STAGGER_MS)
    expect(exitTotalMs(50)).toBe(CHIP_EXIT_MS + CHIP_EXIT_MAX_STAGGER_STEPS * CHIP_EXIT_STAGGER_MS)
  })
})

describe('formatNameList', () => {
  it('joins names readably and truncates long lists', () => {
    expect(formatNameList([])).toBe('')
    expect(formatNameList(['A'])).toBe('A')
    expect(formatNameList(['A', 'B'])).toBe('A and B')
    expect(formatNameList(['A', 'B', 'C'])).toBe('A, B and C')
    expect(formatNameList(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C and 2 more')
  })
})

describe('summarizeRemoval', () => {
  const IN_USE = "Can't delete, it's still used by existing transactions."

  it('keeps the exact onRemove message for a single failed removal', () => {
    const summary = summarizeRemoval([{ name: 'Food', error: IN_USE }], 'Expense categories')
    expect(summary).toEqual({ removed: [], failed: ['Food'], toast: null, error: IN_USE })
  })

  it('names a single removed item in the toast', () => {
    const summary = summarizeRemoval([{ name: 'Food' }], 'Expense categories')
    expect(summary.toast).toBe('Deleted Food')
    expect(summary.error).toBeNull()
  })

  it('counts a bulk removal and groups failures by reason', () => {
    const summary = summarizeRemoval(
      [
        { name: 'Food', error: IN_USE },
        { name: 'Gym' },
        { name: 'Rent', error: IN_USE },
        { name: 'Pets' },
        { name: 'Odd', error: 'Network down' },
      ],
      'Expense categories'
    )
    expect(summary.removed).toEqual(['Gym', 'Pets'])
    expect(summary.failed).toEqual(['Food', 'Rent', 'Odd'])
    expect(summary.toast).toBe('Deleted 2 from expense categories')
    expect(summary.error).toBe(`Couldn't delete Food and Rent: ${IN_USE} Couldn't delete Odd: Network down`)
  })

  it('reports no toast when every bulk removal failed', () => {
    const summary = summarizeRemoval(
      [
        { name: 'A', error: IN_USE },
        { name: 'B', error: IN_USE },
      ],
      'Accounts'
    )
    expect(summary.toast).toBeNull()
    expect(summary.error).toBe(`Couldn't delete A and B: ${IN_USE}`)
  })
})
