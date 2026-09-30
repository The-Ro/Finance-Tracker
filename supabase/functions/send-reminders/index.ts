// send-reminders: LedgeEaze's daily phone reminders (Web Push).
//
// Three ways in:
// - The daily job (pg_cron, 09:00 IST, migration 2026-09-29_push_reminders.sql)
//   POSTs with the `x-cron-secret` header. push_digest() says what each person
//   should hear about today; every device they turned reminders on for gets one
//   notification. Dead subscriptions (404/410) are removed.
// - Catch-up: the app POSTs {"catchUp": true} with the signed-in user's token
//   when reminders are turned on or the app is opened. After 09:00 IST, that
//   user's devices that missed today's note (turned on after the run, or
//   offline) get it now. last_sent_on still stops a second send the same day.
// - "Send a test" POSTs {"test": true} with the user's token; only that user's
//   own devices get a test notification.
//
// Keys come from Vault via push_server_config() (service role only); nothing
// secret is in this file. Deployed with verify_jwt = false because the daily
// job has no user token; every path checks its own credentials below.

import { createClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** The daily run is at 09:00 India time; catch-up never sends earlier than that. */
const SEND_HOUR_IST = 9

interface Subscription {
  id: string
  owner_user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface Message {
  title: string
  body: string
  url: string
}

type DigestRow = Message & { owner_user_id: string }

let server: Promise<{ app: webpush.ApplicationServer; cronSecret: string }> | null = null
function getServer() {
  server ??= (async () => {
    const { data, error } = await supabase.rpc('push_server_config').single<{ vapid_keys: string; cron_secret: string }>()
    if (error || !data?.vapid_keys) throw new Error('Push keys are not set up: ' + (error?.message ?? 'missing'))
    const vapidKeys = await webpush.importVapidKeys(JSON.parse(data.vapid_keys), { extractable: false })
    const app = await webpush.ApplicationServer.new({
      contactInformation: 'https://finance-tracker.rohith24112.workers.dev',
      vapidKeys,
    })
    return { app, cronSecret: data.cron_secret }
  })()
  return server
}

/** Today's date and hour in India. */
function nowIst(): { date: string; hour: number } {
  const now = new Date()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(now))
  return { date, hour }
}

async function sendTo(app: webpush.ApplicationServer, sub: Subscription, message: Message) {
  const subscriber = app.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
  try {
    await subscriber.pushTextMessage(JSON.stringify({ ...message, tag: 'ledgeeaze-daily' }), { ttl: 12 * 60 * 60, urgency: 'normal' })
    return 'sent' as const
  } catch (e) {
    const status = e instanceof webpush.PushMessageError ? e.response.status : 0
    if (status === 404 || status === 410) {
      await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      return 'gone' as const
    }
    console.error('push failed', status, String(e))
    return 'failed' as const
  }
}

/** Sends today's note to each person's not-yet-notified devices and files it in their history. */
async function deliver(app: webpush.ApplicationServer, rows: DigestRow[], today: string) {
  let sent = 0
  let gone = 0
  let failed = 0
  for (const row of rows) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('owner_user_id', row.owner_user_id)
      .or(`last_sent_on.is.null,last_sent_on.lt.${today}`)
    for (const s of (subs ?? []) as Subscription[]) {
      const result = await sendTo(app, s, { title: row.title, body: row.body, url: row.url })
      if (result === 'sent') {
        sent++
        await supabase.from('push_subscriptions').update({ last_sent_on: today }).eq('id', s.id)
      } else if (result === 'gone') gone++
      else failed++
    }
    // Keep it in the bell's history too (once per person per day).
    await supabase
      .from('notifications')
      .upsert(
        { owner_user_id: row.owner_user_id, kind: 'reminder', title: row.title, body: row.body, url: row.url, ref: 'reminder:' + today },
        { onConflict: 'owner_user_id,ref', ignoreDuplicates: true }
      )
  }
  return { people: rows.length, sent, gone, failed }
}

async function signedInUser(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data, error } = await supabase.auth.getUser(token)
  return error ? null : data.user
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let body: { test?: boolean; catchUp?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    // Empty body from the daily job is fine.
  }
  const { app, cronSecret } = await getServer()
  const { date: today, hour } = nowIst()

  // "Send a test" from the app: the caller's own devices only.
  if (body.test) {
    const user = await signedInUser(req)
    if (!user) return json({ error: 'Sign in first' }, 401)
    const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('owner_user_id', user.id)
    const results = await Promise.all(
      (subs ?? []).map((s: Subscription) =>
        sendTo(app, s, { title: 'Reminders are on', body: 'You will get a short note on days with bills or money due.', url: '/settings/reminders' })
      )
    )
    return json({ devices: results.length, sent: results.filter((r) => r === 'sent').length })
  }

  // Catch-up for the caller's devices that missed today's 9 AM note.
  if (body.catchUp) {
    const user = await signedInUser(req)
    if (!user) return json({ error: 'Sign in first' }, 401)
    if (hour < SEND_HOUR_IST) return json({ date: today, waiting: true })
    const { data: digest, error } = await supabase.rpc('push_digest', { p_today: today })
    if (error) return json({ error: error.message }, 500)
    const rows = ((digest ?? []) as DigestRow[]).filter((r) => r.owner_user_id === user.id)
    return json({ date: today, ...(await deliver(app, rows, today)) })
  }

  // The daily job.
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) return json({ error: 'Not allowed' }, 401)
  const { data: digest, error } = await supabase.rpc('push_digest', { p_today: today })
  if (error) return json({ error: error.message }, 500)
  return json({ date: today, ...(await deliver(app, (digest ?? []) as DigestRow[], today)) })
})
