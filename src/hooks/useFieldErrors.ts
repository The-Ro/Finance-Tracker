import { useCallback, useState } from 'react'

/**
 * Form errors shown where they belong: a problem with one field turns that
 * field red with the message under it (TextField / DateField / Dropdown
 * `error` prop, which also scroll it into view); anything else (a network or
 * server error) is a general message the form shows at its top. Replaces the
 * old single message at the bottom of each form.
 *
 *   const errors = useFieldErrors<'amount' | 'name'>()
 *   if (!ok) return errors.fail('Enter the amount.', 'amount')
 *   <TextField error={errors.on('amount')} ... />
 *   <FormError message={errors.general} />
 */
export function useFieldErrors<F extends string>() {
  const [state, setState] = useState<{ field: F | null; message: string } | null>(null)

  const fail = useCallback((message: string, field?: F) => {
    setState({ field: field ?? null, message })
  }, [])
  const clear = useCallback(() => setState(null), [])
  /** The message for this field, if it's the one that's wrong. */
  // null (not undefined) when fine: a Dropdown given `error` keeps the same
  // wrapper whether or not there's a message, so it doesn't remount.
  const on = (field: F): string | null => (state && state.field === field ? state.message : null)

  return {
    fail,
    clear,
    on,
    /** A message not tied to one field (shown at the top of the form). */
    general: state && state.field === null ? state.message : null,
    any: state !== null,
  }
}
