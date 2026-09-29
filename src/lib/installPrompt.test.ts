import { describe, expect, it } from 'vitest'
import { detectInstallDevice, detectIosBrowser, shouldShowInstallCard } from './installPrompt'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

describe('detectInstallDevice', () => {
  it('tells iPhone, iPad (even in desktop mode), Android and the rest apart', () => {
    expect(detectInstallDevice(IPHONE_SAFARI, 5)).toBe('iphone')
    expect(detectInstallDevice(IPAD_DESKTOP_MODE, 5)).toBe('ipad')
    expect(detectInstallDevice(IPAD_DESKTOP_MODE, 0)).toBe('other') // a real Mac
    expect(detectInstallDevice(ANDROID_CHROME, 5)).toBe('android')
  })
})

describe('detectIosBrowser', () => {
  it('spots Safari, other browsers and in-app web views', () => {
    expect(detectIosBrowser(IPHONE_SAFARI)).toBe('safari')
    expect(detectIosBrowser(IPHONE_CHROME)).toBe('other-browser')
    expect(detectIosBrowser(IPHONE_INSTAGRAM)).toBe('in-app')
  })
})

describe('shouldShowInstallCard', () => {
  const now = Date.UTC(2026, 8, 29)
  const day = 86_400_000
  it('shows on phones and tablets that have not installed it', () => {
    expect(shouldShowInstallCard({ standalone: false, device: 'iphone', snoozedAt: null, now })).toBe(true)
    expect(shouldShowInstallCard({ standalone: false, device: 'ipad', snoozedAt: null, now })).toBe(true)
  })
  it('never shows once installed, or on desktop', () => {
    expect(shouldShowInstallCard({ standalone: true, device: 'iphone', snoozedAt: null, now })).toBe(false)
    expect(shouldShowInstallCard({ standalone: false, device: 'other', snoozedAt: null, now })).toBe(false)
  })
  it('stays hidden for 14 days after "Not now"', () => {
    expect(shouldShowInstallCard({ standalone: false, device: 'android', snoozedAt: now - 13 * day, now })).toBe(false)
    expect(shouldShowInstallCard({ standalone: false, device: 'android', snoozedAt: now - 15 * day, now })).toBe(true)
  })
})
