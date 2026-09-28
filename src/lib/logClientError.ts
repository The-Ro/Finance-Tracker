import { supabase } from './supabaseClient'
import { APP_VERSION } from './whatsNew'

/**
 * Best-effort crash report -- fire-and-forget, and must never throw or await
 * anything the caller depends on, since this runs from inside error-handling
 * paths (ErrorBoundary.componentDidCatch) that are already in a broken state.
 */
export function logClientError(error: Error, extra?: { componentStack?: string }) {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      // Limits mirror client_errors_size_check; an over-long row would be rejected outright.
      await supabase.from('client_errors').insert({
        owner_user_id: data.session?.user.id ?? null,
        message: String(error.message).slice(0, 5000),
        stack: [error.stack, extra?.componentStack].filter(Boolean).join('\n\n').slice(0, 50000),
        url: window.location.href.slice(0, 4096),
        user_agent: navigator.userAgent.slice(0, 1024),
        app_version: APP_VERSION,
      })
    } catch {
      // Logging the error failed too -- nothing more we can do client-side.
    }
  })()
}
