// Currency formatting lives in @/lib/currency + the useFormatCurrency hook,
// since it depends on the signed-in user's chosen currency.

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function initialsFor(nameOrEmail: string): string {
  const trimmed = nameOrEmail.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

// `.toISOString().slice(0, 10)` reads as "just get the date part" but it
// doesn't -- toISOString() converts to UTC first, so for anyone east of UTC
// (IST included) it silently returns *yesterday's* date for the first few
// hours of each local day (and the reverse -- tomorrow's date in the
// evening -- for anyone west of UTC). Every transaction date, recurring
// next_date, and overdue check ultimately runs through this, so building
// the string from the Date object's own local Y/M/D fields instead is what
// actually gives "today" in the sense a human typing a date means it.
export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayISO(): string {
  return toLocalISODate(new Date())
}
