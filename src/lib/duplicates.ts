import { merchantsSimilar } from '@/lib/merchant'
import type { Transaction } from '@/hooks/useTransactions'

/** How many days apart two otherwise-matching transactions can be and still
 *  count as possible duplicates (e.g. a card swipe vs. the later bank-statement
 *  posting date of the same purchase). */
export const DUPLICATE_WINDOW_DAYS = 3

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * Groups of two or more of the owner's transactions that look like the same
 * real-world event entered twice: same type, account(s) and amount, dates
 * within `windowDays` of each other, and a similar merchant.
 *
 * The database's unique fingerprint already blocks exact repeats (same date,
 * merchant, amount, account) -- except where someone used "Save anyway" -- so
 * what this mostly finds are the near-misses it can't: a manual entry plus a
 * CSV import of the same purchase with a slightly different merchant string or
 * posting date. It only ever suggests; nothing here deletes anything.
 *
 * Newest group first; rows within a group newest first.
 */
export function findDuplicateGroups(transactions: Transaction[], windowDays = DUPLICATE_WINDOW_DAYS): Transaction[][] {
  const buckets = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const key = [t.type, t.account, t.to_account ?? '', t.amount.toFixed(2)].join('|')
    const bucket = buckets.get(key)
    if (bucket) bucket.push(t)
    else buckets.set(key, [t])
  }

  const groups: Transaction[][] = []
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue

    // Union-find over the bucket, linking any pair that's close in date and
    // similar in merchant, so a chain (A~B, B~C) ends up as one group.
    const parent = bucket.map((_, i) => i)
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        if (
          Math.abs(dayNumber(bucket[i].date) - dayNumber(bucket[j].date)) <= windowDays &&
          merchantsSimilar(bucket[i].merchant, bucket[j].merchant)
        ) {
          parent[find(i)] = find(j)
        }
      }
    }

    const clusters = new Map<number, Transaction[]>()
    bucket.forEach((t, i) => {
      const root = find(i)
      const cluster = clusters.get(root)
      if (cluster) cluster.push(t)
      else clusters.set(root, [t])
    })
    for (const cluster of clusters.values()) if (cluster.length >= 2) groups.push(cluster)
  }

  const newestFirst = (a: Transaction, b: Transaction) =>
    b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
  for (const g of groups) g.sort(newestFirst)
  groups.sort((a, b) => newestFirst(a[0], b[0]))
  return groups
}

/** Every pair of ids in a group, each as "smallerId|largerId" -- what "Not a duplicate" remembers. */
export function duplicatePairs(group: { id: string }[]): string[] {
  const ids = group.map((t) => t.id).sort()
  const out: string[] = []
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push(`${ids[i]}|${ids[j]}`)
  return out
}

/**
 * Groups still worth showing: a group is hidden once every pair in it was
 * marked "Not a duplicate". A new entry that joins a dismissed group brings
 * new pairs, so the group shows again (with the new one in it).
 */
export function withoutDismissed<T extends { id: string }>(groups: T[][], dismissed: ReadonlySet<string>): T[][] {
  return groups.filter((g) => !duplicatePairs(g).every((p) => dismissed.has(p)))
}
