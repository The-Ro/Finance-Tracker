/* global self, URL */
/* LedgeEaze phone reminders. Pulled into the generated service worker via
   workbox.importScripts (vite.config.ts). The daily message comes from the
   send-reminders Edge Function as JSON: { title, body, url, tag }. */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'LedgeEaze'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'ledgeeaze',
      renotify: true,
      data: { url: data.url || '/' },
    })
  )
})

// Tapping it opens (or focuses) the app on the right page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = (event.notification.data && event.notification.data.url) || '/'
  const target = new URL(path, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin) && 'focus' in w) {
          return w.focus().then(() => ('navigate' in w ? w.navigate(target) : undefined))
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
