import clsx from 'clsx'

interface InlineMessageProps {
  tone: 'error' | 'success'
  children: string
}

export function InlineMessage({ tone, children }: InlineMessageProps) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={clsx(
        'animate-fade-in-up rounded-lg px-3 py-2 text-helper',
        tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-positive-light text-positive'
      )}
    >
      {children}
    </p>
  )
}
