// Phone reminders (Web Push) on this device. The server side is the
// send-reminders Edge Function + the daily job (migration
// 2026-09-29_push_reminders.sql); this file only asks permission, subscribes
// and saves the subscription through save_push_subscription().

import { supabase } from '@/lib/supabaseClient'

/** Must match the public half of the push_vapid_keys secret in Vault. */
export const VAPID_PUBLIC_KEY =
  'BAHVd-_T6IPeXTOIOy48rZmz38t0lLZ3h3HZGau8xW-Z-8nDw3MNlJIGYhGDh1kyAJxZ76hoPjXKAwE6pVS4sSY'

export type PushState =
  /** This browser can't do push at all. */
  | 'unsupported'
  /** iPhone/iPad in Safari: only the home-screen app can get notifications. */
  | 'needs-install'
  /** The person said no; only the phone's Settings can undo that. */
  | 'blocked'
  | 'off'
  | 'on'

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function isIosBrowserTab(): boolean {
  const ua = navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  return ios && !standalone
}

function keyBytes(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null
  // No service worker in dev (vite-plugin-pwa only builds one for production).
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

export async function currentPushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported'
  if (isIosBrowserTab()) return 'needs-install'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

/** Asks permission (must be called from a tap), subscribes and saves it for the signed-in user. */
export async function turnOnReminders(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready)
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource }))
  const json = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
  })
  if (error) throw error
  return 'on'
}

/** Stops reminders on this device (and forgets it on the server). Safe to call when off. */
export async function turnOffReminders(): Promise<void> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Sends a test notification to all of the signed-in user's devices. */
export async function sendTestReminder(): Promise<{ devices: number; sent: number }> {
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { test: true } })
  if (error) throw error
  return data as { devices: number; sent: number }
}
