import { describe, expect, it } from 'vitest'
import { merchantContains, merchantsSimilar, normalizeMerchant } from '@/lib/merchant'

describe('normalizeMerchant', () => {
  it('strips punctuation, trailing store numbers and long reference numbers', () => {
    expect(normalizeMerchant('  BLUE-BOTTLE Coffee #4471 ')).toBe('blue bottle coffee')
    expect(normalizeMerchant('UBER *TRIP 88123456')).toBe('uber trip')
  })

  it('keeps letters from any script and folds accents', () => {
    expect(normalizeMerchant('スターバックス')).toBe('スターバックス')
    expect(normalizeMerchant('Café Nero')).toBe('cafe nero')
    expect(normalizeMerchant('Crème Brûlée #12')).toBe('creme brulee')
    expect(normalizeMerchant('ＡＭＡＺＯＮ')).toBe('amazon')
    expect(normalizeMerchant('बिग बाज़ार')).not.toBe('')
    expect(merchantsSimilar('CAFÉ NERO', 'Cafe Nero')).toBe(true)
  })
})

describe('merchantsSimilar', () => {
  it('matches equal or contained normalized names, but not very short ones', () => {
    expect(merchantsSimilar('Amazon', 'AMAZON PRIME')).toBe(true)
    expect(merchantsSimilar('Ola', 'Ola Cabs')).toBe(false)
    expect(merchantsSimilar('Blue Bottle', 'Metro Pharmacy')).toBe(false)
  })
})

describe('merchantContains', () => {
  it('keeps plain case-insensitive substring matches', () => {
    expect(merchantContains('NETFLIX.COM', 'netflix')).toBe(true)
  })

  it('also matches after normalization', () => {
    expect(merchantContains('UBER *TRIP 88123456', 'uber trip')).toBe(true)
    expect(merchantContains('AMAZON.COM*A1B2C3', 'amazon com')).toBe(true)
  })

  it('never lets an empty or all-punctuation needle match everything', () => {
    expect(merchantContains('Corner Store', '')).toBe(false)
    expect(merchantContains('Corner Store', '   ')).toBe(false)
    expect(merchantContains('Corner Store', '#12')).toBe(false)
    expect(merchantContains('Store #12', '#12')).toBe(true)
  })
})
