const STOP_WORDS = new Set(['of', 'the', 'and', '&'])
const CARD_WORDS = new Set(['debit', 'card', 'cards', 'atm'])

/**
 * Which bank an old "… Debit Card" account most likely spends from: a shared
 * word ("HDFC Debit" -> "HDFC Bank") or initials ("SBI Debit Card" ->
 * "State Bank of India"). Only answers when exactly one bank fits.
 */
export function guessLinkedAccount(source: string, banks: readonly string[]): string | undefined {
  const tokens = source
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !CARD_WORDS.has(t))
  if (tokens.length === 0) return undefined
  const fits = banks.filter((bank) => {
    const words = bank.toLowerCase().split(/[^a-z0-9&]+/).filter(Boolean)
    const initials = words
      .filter((w) => !STOP_WORDS.has(w))
      .map((w) => w[0])
      .join('')
    return tokens.some((t) => words.includes(t) || (t.length >= 2 && t === initials))
  })
  return fits.length === 1 ? fits[0] : undefined
}
