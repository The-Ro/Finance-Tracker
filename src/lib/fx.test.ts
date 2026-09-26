import { describe, expect, it } from 'vitest'
import { buildFxUrl, convertToHome, parseFxResponse } from '@/lib/fx'

describe('convertToHome', () => {
  it('multiplies and rounds to 2 decimal places', () => {
    expect(convertToHome(20, 109.8755)).toBe(2197.51)
    expect(convertToHome(0.1, 3)).toBe(0.3)
  })
})

describe('buildFxUrl', () => {
  it('builds a Frankfurter URL with encoded parts', () => {
    expect(buildFxUrl('EUR', 'INR', '2026-09-20')).toBe('https://api.frankfurter.dev/v1/2026-09-20?from=EUR&to=INR')
  })
})

describe('parseFxResponse', () => {
  it('extracts the target rate and the business date used', () => {
    expect(parseFxResponse({ amount: 1, base: 'EUR', date: '2026-09-18', rates: { INR: 109.8755 } }, 'INR')).toEqual({
      rate: 109.8755,
      date: '2026-09-18',
    })
  })

  it('rejects missing, non-numeric or non-positive rates', () => {
    expect(parseFxResponse({ rates: {} }, 'INR')).toBeNull()
    expect(parseFxResponse({ rates: { INR: '109' } }, 'INR')).toBeNull()
    expect(parseFxResponse({ rates: { INR: 0 } }, 'INR')).toBeNull()
    expect(parseFxResponse(null, 'INR')).toBeNull()
  })
})
