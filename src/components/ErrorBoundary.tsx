import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { logClientError } from '@/lib/logClientError'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Without this, any uncaught render error unmounts the whole React tree and
 * leaves the user staring at a blank white page with no way back in short of
 * knowing to manually reload -- worse on an installed PWA, which has no
 * browser chrome (refresh button, URL bar) to fall back on.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
    logClientError(error, { componentStack: info.componentStack ?? undefined })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app-bg px-6 text-center">
        <AlertTriangle size={32} className="text-caution" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-1 max-w-sm text-helper text-slate-500">
            LedgeEaze ran into an unexpected error. Reloading usually fixes it — your data is safe either way.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Reload
        </button>
      </div>
    )
  }
}
