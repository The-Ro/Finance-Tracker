import { supabase } from './supabaseClient'

/**
 * Best-effort crash report -- fire-and-forget, and must never throw or await
 * anything the caller depends on, since this runs from inside error-handling
 * paths (ErrorBoundary.componentDidCatch) that are already in a broken state.
 */
export function logClientError(error: Error, extra?: { componentStack?: string }) {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      await supabase.from('client_errors').insert({
        owner_user_id: data.session?.user.id ?? null,
        message: error.message,
        stack: [error.stack, extra?.componentStack].filter(Boolean).join('\n\n'),
        url: window.location.href,
        user_agent: navigator.userAgent,
      })
    } catch {
      // Logging the error failed too -- nothing more we can do client-side.
    }
  })()
}
