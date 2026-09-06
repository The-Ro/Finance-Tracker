import type { ZodiacSign } from '@/types/database.types'

export interface ZodiacOption {
  sign: ZodiacSign
  label: string
  symbol: string
}

export const ZODIAC_SIGNS: ZodiacOption[] = [
  { sign: 'aries', label: 'Aries', symbol: '♈' },
  { sign: 'taurus', label: 'Taurus', symbol: '♉' },
  { sign: 'gemini', label: 'Gemini', symbol: '♊' },
  { sign: 'cancer', label: 'Cancer', symbol: '♋' },
  { sign: 'leo', label: 'Leo', symbol: '♌' },
  { sign: 'virgo', label: 'Virgo', symbol: '♍' },
  { sign: 'libra', label: 'Libra', symbol: '♎' },
  { sign: 'scorpio', label: 'Scorpio', symbol: '♏' },
  { sign: 'sagittarius', label: 'Sagittarius', symbol: '♐' },
  { sign: 'capricorn', label: 'Capricorn', symbol: '♑' },
  { sign: 'aquarius', label: 'Aquarius', symbol: '♒' },
  { sign: 'pisces', label: 'Pisces', symbol: '♓' },
]

export function zodiacLabel(sign: ZodiacSign): string {
  const option = ZODIAC_SIGNS.find((z) => z.sign === sign)
  return option ? `${option.symbol} ${option.label}` : sign
}
