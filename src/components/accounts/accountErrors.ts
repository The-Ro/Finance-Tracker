const UNIQUE_VIOLATION = '23505'
const FK_VIOLATION = '23503'

/** Plain-words message for an account/debit-card save or remove failure (Error or a PostgREST error object). */
export function friendlyAccountError(e: unknown, fallback: string): string {
  const err = (typeof e === 'object' && e !== null ? e : {}) as { code?: string; message?: string }
  const message = err.message ?? ''
  if (err.code === UNIQUE_VIOLATION || /duplicate key/i.test(message)) return 'You already have one with that name.'
  if (err.code === FK_VIOLATION) return 'It still has transactions or recurring payments, so it can’t be removed.'
  if (/move or remove its debit cards first/i.test(message)) {
    return 'This account still has debit cards. Move them to another account or remove them first.'
  }
  if (/must draw from a savings or current account/i.test(message)) {
    return 'A debit card has to draw from a savings or current account.'
  }
  if (/already has purchases on/i.test(message)) {
    return 'This card already has purchases on its account, so it can’t move. Add a new card for the other account instead.'
  }
  if (/cash is always kept/i.test(message)) return 'Cash is always here, so it can’t be removed, closed or turned into another type.'
  if (/last 4 digits/i.test(message)) return 'The last 4 digits must be 4 numbers.'
  if (/unknown account type/i.test(message)) return 'That account type isn’t available. Refresh the page and try again.'
  return message || fallback
}
