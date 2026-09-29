import clsx from 'clsx'
import type { CardNetwork } from '@/types/database.types'
import { CARD_NETWORKS, CARD_NETWORK_LABELS } from '@/lib/cardNetworks'

/**
 * Visa / Mastercard / RuPay / ... for a debit or credit card; tap the chosen
 * one again to clear it. `hint` explains what the choice changes (a RuPay
 * credit card can pay by UPI).
 */
export function CardNetworkPicker({
  value,
  onChange,
  idPrefix,
  hint,
}: {
  value: CardNetwork | null
  onChange: (network: CardNetwork | null) => void
  idPrefix: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${idPrefix}-network-label`} className="text-helper font-medium text-slate-600">
        Card type (optional)
      </span>
      <div role="group" aria-labelledby={`${idPrefix}-network-label`} className="flex flex-wrap gap-1.5">
        {CARD_NETWORKS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onChange(value === n ? null : n)}
            className={clsx(
              'press min-h-[40px] rounded-full border px-3.5 text-sm font-medium transition-colors',
              value === n
                ? 'border-accent bg-accent-light text-accent-on-light'
                : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
            )}
          >
            {CARD_NETWORK_LABELS[n]}
          </button>
        ))}
      </div>
      {hint && <p className="text-helper text-slate-500">{hint}</p>}
    </div>
  )
}
