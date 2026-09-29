import clsx from 'clsx'
import { Modal } from '@/components/ui/Modal'
import { CategoryIconByKey } from '@/components/ui/CategoryIcon'
import { CATEGORY_ICON_CHOICES, type CategoryIconKey } from '@/lib/categoryIcon'

/** A grid of every category icon; picking one closes it. */
export function CategoryIconPicker({
  open,
  title,
  value,
  onPick,
  onClose,
}: {
  open: boolean
  title: string
  value: CategoryIconKey | null
  onPick: (key: CategoryIconKey) => void
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {CATEGORY_ICON_CHOICES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            aria-label={label}
            onClick={() => onPick(key)}
            className={clsx(
              'press flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1 text-center text-[11px] font-medium leading-tight transition-colors',
              value === key
                ? 'border-accent bg-accent-light text-accent-on-light'
                : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
            )}
          >
            <CategoryIconByKey iconKey={key} size={20} />
            <span className="line-clamp-2">{label}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
