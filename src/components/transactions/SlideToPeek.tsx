import { useRef, type PointerEvent } from 'react'
import { ChevronsRight, Lock } from 'lucide-react'

const KNOB = 36
/** Past this share of the track, letting go reveals the row. */
const REVEAL_AT = 0.55

/**
 * "Slide to see" over a locked Activity row: drag the knob and the row's blur
 * eases off with your finger (a `--peek` 0..1 variable on the nearest
 * `.private-row`, read by `.private-content.is-hidden` in index.css); let go
 * past halfway and the row opens (`onReveal`), otherwise it springs back. A
 * plain tap reveals too. Pointer events stop here, so the row's own swipe
 * (SwipeRow) doesn't start.
 */
export function SlideToPeek({ label, onReveal }: { label: string; onReveal: () => void }) {
  const trackRef = useRef<HTMLButtonElement>(null)
  const knobRef = useRef<HTMLSpanElement>(null)
  const drag = useRef<{ startX: number; dx: number; max: number } | null>(null)

  const row = () => trackRef.current?.closest<HTMLElement>('.private-row') ?? null
  const setProgress = (p: number, animate: boolean) => {
    const r = row()
    const knob = knobRef.current
    const max = drag.current?.max ?? 0
    r?.classList.toggle('is-peeking', !animate)
    r?.style.setProperty('--peek', String(p))
    if (knob) {
      knob.style.transition = animate ? 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
      knob.style.transform = `translateX(${p * max}px)`
    }
  }

  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const track = trackRef.current
    if (!track) return
    track.setPointerCapture?.(e.pointerId)
    drag.current = { startX: e.clientX, dx: 0, max: Math.max(1, track.clientWidth - KNOB - 8) }
  }
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const d = drag.current
    if (!d) return
    d.dx = Math.min(d.max, Math.max(0, e.clientX - d.startX))
    setProgress(d.dx / d.max, false)
  }
  const onUp = (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const d = drag.current
    drag.current = null
    if (!d) return
    const p = d.dx / d.max
    // A tap (barely moved) or a slide past the line opens it.
    if (d.dx < 6 || p >= REVEAL_AT) {
      drag.current = { ...d }
      setProgress(1, true)
      drag.current = null
      // Captured now: this slider unmounts once the row opens, but the row
      // stays, and its --peek must go back to 0 so it blurs again later.
      const r = row()
      onReveal()
      window.setTimeout(() => {
        r?.style.removeProperty('--peek')
        r?.classList.remove('is-peeking')
      }, 400)
    } else {
      drag.current = { ...d }
      setProgress(0, true)
      drag.current = null
    }
  }

  return (
    <button
      ref={trackRef}
      type="button"
      aria-label={label}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={(e) => {
        e.stopPropagation()
        drag.current = null
        setProgress(0, true)
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onReveal()
        }
      }}
      className="relative flex h-11 w-[208px] max-w-full touch-none select-none items-center rounded-full border border-app-border bg-app-card/95 p-1 shadow-card"
    >
      <span
        ref={knobRef}
        className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-card"
      >
        <Lock size={14} aria-hidden="true" />
      </span>
      <span className="pointer-events-none flex flex-1 items-center justify-center gap-1 pr-2 text-helper font-semibold text-slate-600">
        Slide to see
        <ChevronsRight size={15} aria-hidden="true" className="peek-nudge text-slate-400" />
      </span>
    </button>
  )
}
