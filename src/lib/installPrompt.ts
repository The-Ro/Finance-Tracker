// Who gets the "Add LedgeEaze to your home screen" card, and which help.
//
// Android / Chrome-family browsers fire `beforeinstallprompt`, so there the
// card's Install button opens the browser's own install dialog (one tap, then
// the browser's confirm). iPhone and iPad have no install API for websites at
// all -- the only way is Share -> Add to Home Screen -- so the card shows those
// steps instead, and has to tell in-app browsers (Instagram, Gmail, ...) to
// open the page in Safari first, since they can't add to the home screen.

export type InstallDevice = 'iphone' | 'ipad' | 'android' | 'other'
/** On iOS: Safari (or Chrome/Edge/Firefox, which can also Add to Home Screen from iOS 16.4) vs an in-app browser, which can't. */
export type IosBrowser = 'safari' | 'other-browser' | 'in-app'

export function detectInstallDevice(ua: string, maxTouchPoints = 0): InstallDevice {
  if (/iphone|ipod/i.test(ua)) return 'iphone'
  // iPadOS 13+ says "Macintosh" by default; a Mac with a touchscreen doesn't exist.
  if (/ipad/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1)) return 'ipad'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

export function detectIosBrowser(ua: string): IosBrowser {
  // In-app web views: Facebook/Instagram/LinkedIn/Gmail/Line/Snapchat/etc.
  if (/FBAN|FBAV|Instagram|LinkedInApp|GSA\/|Line\/|Snapchat|MicroMessenger|Twitter/i.test(ua)) return 'in-app'
  if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return 'other-browser'
  // Safari has "Safari/"; a bare WKWebView doesn't.
  return /Safari\//.test(ua) ? 'safari' : 'in-app'
}

/** How long "Not now" hides the card. */
export const INSTALL_SNOOZE_DAYS = 14

export function shouldShowInstallCard(opts: {
  standalone: boolean
  device: InstallDevice
  /** When "Not now" was last tapped (ms), if ever. */
  snoozedAt: number | null
  now: number
}): boolean {
  if (opts.standalone) return false
  // Phones and tablets only; desktop keeps the profile menu's "Install app".
  if (opts.device === 'other') return false
  if (opts.snoozedAt !== null && opts.now - opts.snoozedAt < INSTALL_SNOOZE_DAYS * 86_400_000) return false
  return true
}
