/**
 * Shared merchant-name helpers. The *tolerant* notion of "same merchant" used
 * by recurring detection, duplicate review and rule matching lives here.
 *
 * Deliberately NOT used by buildFingerprint (fingerprint.ts), which stays a
 * strict trim+lowercase match: the fingerprint is a hard unique constraint, and
 * normalizing it would make two genuinely different purchases
 * ("AMAZON*A1B2" vs "AMAZON*C3D4") collide. Stored merchant text is never
 * rewritten either -- normalization is only ever a derived, in-memory key.
 */

/** Lowercases, folds accents ("Café" -> "cafe") and full-width forms, and
 *  strips punctuation, trailing store numbers ("#1234") and long reference
 *  numbers (6+ digits). Letters in any script are kept, so a merchant written
 *  in Japanese or Devanagari doesn't normalize to nothing. */
export function normalizeMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .trim()
    .replace(/#\s*\d+\s*$/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MIN_CONTAINED_LENGTH = 4

/** Same merchant after normalization, or one normalized name containing the
 *  other ("amazon" vs "amazon prime") when the shorter is at least 4 chars. */
export function merchantsSimilar(a: string, b: string): boolean {
  const na = normalizeMerchant(a)
  const nb = normalizeMerchant(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na]
  return shorter.length >= MIN_CONTAINED_LENGTH && longer.includes(shorter)
}

/** Whether `merchant` contains `needle`, either as plain case-insensitive
 *  text or after normalizing both (so "uber" matches "UBER *TRIP 88123456").
 *  A needle that normalizes to nothing (e.g. "#12") only uses the plain
 *  check, so it can never match every merchant. */
export function merchantContains(merchant: string, needle: string): boolean {
  const n = needle.trim().toLowerCase()
  if (!n) return false
  if (merchant.toLowerCase().includes(n)) return true
  const nn = normalizeMerchant(needle)
  return nn.length > 0 && normalizeMerchant(merchant).includes(nn)
}
