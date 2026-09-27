/**
 * Splits a flat nav list into labelled sections ("Money", "Plan", "More")
 * for the desktop sidebar. Each section names its routes by path, in the
 * order they should appear.
 *
 * Nothing is ever dropped: an item that no section claims (a page added to
 * NAV_ITEMS later without updating the grouping) lands at the end of the
 * last section, so a missed update shows up as a slightly misplaced row
 * rather than a page with no way to reach it. A path listed in more than one
 * section only appears in the first; a path with no matching item is
 * ignored; a section left with no items is omitted.
 */
export interface NavGroupSpec {
  label: string
  paths: string[]
}

export interface NavGroupOf<T> {
  label: string
  items: T[]
}

export function groupNavItems<T extends { to: string }>(items: T[], specs: NavGroupSpec[]): NavGroupOf<T>[] {
  const byPath = new Map(items.map((item) => [item.to, item]))
  const used = new Set<string>()

  const groups = specs.map(({ label, paths }) => {
    const groupItems: T[] = []
    for (const path of paths) {
      const item = byPath.get(path)
      if (!item || used.has(path)) continue
      used.add(path)
      groupItems.push(item)
    }
    return { label, items: groupItems }
  })

  const leftovers = items.filter((item) => !used.has(item.to))
  if (leftovers.length > 0) {
    if (groups.length > 0) groups[groups.length - 1].items.push(...leftovers)
    else groups.push({ label: 'More', items: leftovers })
  }

  return groups.filter((g) => g.items.length > 0)
}
