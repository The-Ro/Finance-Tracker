/**
 * Shares plain text through the device's share sheet (WhatsApp, Messages...)
 * when available, otherwise copies it to the clipboard. The app itself sends
 * no messages -- this hands the text to the user's own apps.
 */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, text })
      return 'shared'
    }
  } catch (e) {
    // The user closed the share sheet -- not an error worth a fallback.
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
