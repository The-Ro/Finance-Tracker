import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { logClientError } from './lib/logClientError'
import './index.css'

// The ErrorBoundary below only catches errors thrown during React's render
// -- an exception in an event handler or async code (a mutation's onClick,
// a .then() callback) just gets logged to the console and swallowed by the
// browser otherwise. These two catch the rest.
window.addEventListener('error', (event) => {
  logClientError(event.error instanceof Error ? event.error : new Error(String(event.message)))
})
window.addEventListener('unhandledrejection', (event) => {
  logClientError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
