import clsx from 'clsx'

interface ProgressBarProps {
  percent: number
  tone?: 'accent' | 'positive' | 'caution' | 'danger'
}

const TONE_CLASSES: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  accent: 'bg-accent',
  positive: 'bg-positive',
  caution: 'bg-caution',
  danger: 'bg-red-500',
}

export function ProgressBar({ percent, tone = 'accent' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx('h-full rounded-full transition-all', TONE_CLASSES[tone])} style={{ width: `${clamped}%` }} />
    </div>
  )
}
