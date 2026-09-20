import { useEffect, useRef, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Animates numeric transitions (stat cards, progress amounts) via requestAnimationFrame. */
export function useAnimatedNumber(target: number, duration = 700): number {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef<number>()

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      setValue(target)
      fromRef.current = target
      return
    }

    const from = fromRef.current
    if (from === target) return

    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      setValue(from + (target - from) * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        fromRef.current = target
      }
    }
    frameRef.current = requestAnimationFrame(animate)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      fromRef.current = target
    }
  }, [target, duration])

  return value
}
