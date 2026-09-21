import { X } from 'lucide-react'

interface PillProps {
  label: string
  onRemove?: () => void
}

export function Pill({ label, onRemove }: PillProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-2.5 py-1 text-helper font-medium text-accent-on-light">
      {label}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove tag ${label}`}
          onClick={onRemove}
          className="rounded-full hover:bg-accent/20"
        >
          <X size={12} />
        </button>
      )}
    </span>
  )
}
