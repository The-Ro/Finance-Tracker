import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

const SIZE = 64
const STROKE = 7
const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

interface GoalRingProps {
  /** 0-100, already clamped. */
  percent: number
  reached: boolean
  label: string
}

/**
 * Circular goal progress. Starts empty and fills in (stroke-dashoffset
 * transition) the first time it scrolls into view; later changes (Add money)
 * animate from the current fill. With reduced motion it's drawn at its final
 * value straight away. A reached goal fills with the brass tone.
 */
export function GoalRing({ percent, reached, label }: GoalRingProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(prefersReducedMotion)

  useEffect(() => {
    if (inView) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [inView])

  const shown = inView ? percent : 0
  const offset = CIRCUMFERENCE * (1 - shown / 100)
  // 99.6% shouldn't read as 100% until the goal is actually reached.
  const rounded = reached ? 100 : Math.min(99, Math.round(percent))

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded}
      className="relative h-16 w-16 shrink-0"
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-app-border" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          // A 0% ring would still show a round-cap dot; hide it until there's something to draw.
          opacity={shown > 0 ? 1 : 0}
          className={clsx(
            'motion-safe:transition-[stroke-dashoffset,stroke] motion-safe:duration-[900ms] motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
            reached ? 'stroke-brass' : 'stroke-positive'
          )}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-slate-900">
        {rounded}%
      </span>
    </div>
  )
}
