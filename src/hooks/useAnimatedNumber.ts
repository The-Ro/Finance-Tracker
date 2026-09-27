import { useEffect, useRef, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Motion spec's "hero count-up" duration -- the Home balance hero passes
 *  this; stat cards and progress amounts keep the 700ms default. */
export const HERO_COUNT_UP_MS = 1200

/** Animates numeric transitions (stat cards, progress amounts) via requestAnimationFrame.
 *  `duration` is optional (default 700ms); the Home hero uses HERO_COUNT_UP_MS. */
export function useAnimatedNumber(target: number, duration = 700): number {
  const [value, setValue] = useState(target)
  // The number currently on screen. Each new target animates from here (not
  // from the previous target), so a target that changes mid-animation -- data
  // arriving in pieces on first load -- can never leave the figure stuck.
  const shownRef = useRef(target)
  const frameRef = useRef<number>()

  useEffect(() => {
    const show = (n: number) => {
      shownRef.current = n
      setValue(n)
    }
    if (typeof window === 'undefined' || window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      show(target)
      return
    }

    const from = shownRef.current
    if (from === target) {
      show(target)
      return
    }

    const start = performance.now()
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      show(progress < 1 ? from + (target - from) * easeOutCubic(progress) : target)
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration])

  return value
}
