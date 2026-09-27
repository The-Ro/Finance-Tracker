/**
 * Pure helpers for ManagedListEditor's selection mode (Settings -> Financial
 * setup: expense/income categories and accounts). The component owns the
 * state and the animation; this file owns the rules, so they're unit-tested.
 */

/** How long one chip takes to scale + fade out. */
export const CHIP_EXIT_MS = 180
/** Delay between consecutive chips leaving. */
export const CHIP_EXIT_STAGGER_MS = 40
/** Stagger stops growing after this many steps, so deleting 30 chips doesn't take seconds. */
export const CHIP_EXIT_MAX_STAGGER_STEPS = 6

/** Returns a new set with `name` added if it was missing, removed if it was there. */
export function toggleSelected(selected: ReadonlySet<string>, name: string): Set<string> {
  const next = new Set(selected)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  return next
}

/** Drops selected names that are no longer in the list (removed elsewhere, refetched). */
export function pruneSelected(selected: ReadonlySet<string>, items: readonly string[]): Set<string> {
  const present = new Set(items)
  return new Set([...selected].filter((name) => present.has(name)))
}

/** Items in list order that are selected, so chips leave left to right. */
export function selectedInOrder(selected: ReadonlySet<string>, items: readonly string[]): string[] {
  return items.filter((name) => selected.has(name))
}

/** Animation delay for the chip at `index` among those leaving. */
export function exitDelayMs(index: number): number {
  return Math.min(Math.max(index, 0), CHIP_EXIT_MAX_STAGGER_STEPS) * CHIP_EXIT_STAGGER_MS
}

/** Time until the last of `count` leaving chips has finished its exit. */
export function exitTotalMs(count: number): number {
  if (count <= 0) return 0
  return CHIP_EXIT_MS + exitDelayMs(count - 1)
}

/** "A", "A and B", "A, B and C", "A, B, C and 2 more". */
export function formatNameList(names: readonly string[], max = 3): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length > max) {
    return `${names.slice(0, max).join(', ')} and ${names.length - max} more`
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export interface RemovalOutcome {
  name: string
  /** Set when the removal failed; the message the list's onRemove threw. */
  error?: string
}

export interface RemovalSummary {
  removed: string[]
  failed: string[]
  /** Success toast text, or null when nothing was removed. */
  toast: string | null
  /** Inline error text, or null when everything was removed. */
  error: string | null
}

/**
 * Turns per-item removal results into the toast and inline error. A single
 * removal keeps the exact message onRemove threw (the same explanation the
 * editor showed before selection mode existed, e.g. "still used by existing
 * transactions"); a bulk removal names which ones failed, grouped by reason.
 */
export function summarizeRemoval(outcomes: readonly RemovalOutcome[], listTitle: string): RemovalSummary {
  const removed = outcomes.filter((o) => o.error === undefined).map((o) => o.name)
  const failedOutcomes = outcomes.filter((o) => o.error !== undefined)
  const failed = failedOutcomes.map((o) => o.name)

  let toast: string | null = null
  if (removed.length === 1) toast = `Deleted ${removed[0]}`
  else if (removed.length > 1) toast = `Deleted ${removed.length} from ${listTitle.toLowerCase()}`

  let error: string | null = null
  if (failedOutcomes.length > 0) {
    if (outcomes.length === 1) {
      error = failedOutcomes[0].error as string
    } else {
      const byReason = new Map<string, string[]>()
      for (const o of failedOutcomes) {
        const reason = o.error as string
        byReason.set(reason, [...(byReason.get(reason) ?? []), o.name])
      }
      error = [...byReason.entries()]
        .map(([reason, names]) => `Couldn't delete ${formatNameList(names)}: ${reason}`)
        .join(' ')
    }
  }

  return { removed, failed, toast, error }
}
