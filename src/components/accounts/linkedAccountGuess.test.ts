import { describe, expect, it } from 'vitest'
import { guessLinkedAccount } from './linkedAccountGuess'

const banks = ['HDFC Bank', 'State Bank of India', 'ICICI Current', 'Bank of Baroda']

describe('guessLinkedAccount', () => {
  it('matches a shared word', () => {
    expect(guessLinkedAccount('HDFC Debit Card', banks)).toBe('HDFC Bank')
  })

  it('matches initials, skipping "of"', () => {
    expect(guessLinkedAccount('SBI Debit Card', banks)).toBe('State Bank of India')
  })

  it('gives up when several banks fit or nothing does', () => {
    expect(guessLinkedAccount('Bank Debit Card', banks)).toBeUndefined()
    expect(guessLinkedAccount('Debit Card', banks)).toBeUndefined()
    expect(guessLinkedAccount('Axis Debit', banks)).toBeUndefined()
  })
})
