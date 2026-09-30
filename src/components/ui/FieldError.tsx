import { useEffect, useRef } from 'react'
import { AlertCircle } from 'lucide-react'

/** The red message under a field (TextField / DateField / Dropdown `error`). */
export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="animate-fade-in flex items-start gap-1 text-helper font-medium text-danger">
      <AlertCircle size={13} className="mt-[3px] shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  )
}

/** A form-level problem (network, server), shown at the top of the form. */
export function FormError({ message }: { message?: string | null }) {
  const ref = useRevealOnError<HTMLParagraphElement>(message)
  if (!message) return null
  return (
    <p ref={ref} role="alert" className="animate-shake flex items-start gap-2 rounded-lg bg-danger-light px-3 py-2 text-helper font-medium text-danger">
      <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  )
}

/**
 * When a field gets an error: scroll it to the middle of its (sheet's)
 * scroll area and optionally focus it, so the red field is what you see.
 */
export function useRevealOnError<T extends HTMLElement>(error: string | null | undefined, focusSelector?: string) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!error || !ref.current) return
    ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    if (focusSelector) ref.current.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true })
  }, [error, focusSelector])
  return ref
}
