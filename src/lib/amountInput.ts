// Amounts you type show with thousands commas ("62,000", or "62,000.5" while
// typing a decimal) but the form keeps the plain number text ("62000"), so
// every Number(value) / parse in the forms keeps working unchanged.

/** Keeps digits and the first decimal point, at most two decimals: "62,000.567" -> "62000.56". */
export function cleanAmountInput(raw: string): string {
  let out = ''
  let dot = false
  let decimals = 0
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      if (dot) {
        if (decimals >= 2) continue
        decimals++
      }
      out += ch
    } else if ((ch === '.' || ch === '٫') && !dot) {
      dot = true
      out += '.'
    }
  }
  // "0005" -> "5", but keep a lone "0" and "0.5".
  return out.replace(/^0+(?=\d)/, '')
}

/** Adds the locale's grouping to the whole part of a cleaned amount; the decimal part stays as typed. */
export function groupAmountInput(clean: string, locale?: string): string {
  if (!clean) return ''
  const [whole, decimal] = clean.split('.')
  const grouped = whole ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: true }).format(Number(whole)) : '0'
  return decimal !== undefined ? `${grouped}.${decimal}` : grouped
}
