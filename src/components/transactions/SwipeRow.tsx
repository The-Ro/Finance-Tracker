import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { dragOffset, snapOffset, SWIPE_ACTION_WIDTH } from '@/lib/activityList'

export interface SwipeAction {
  key: string
  label: string
  icon: LucideIcon
  onSelect: () => void
  /** Background/text classes for the action (theme tokens). */
  className: string
}

interface SwipeRowProps {
  /** No actions = a plain, non-swipeable row (e.g. someone else's shared row). */
  actions: SwipeAction[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names the row for the "More actions" button, e.g. the merchant. */
  label: string
  children: ReactNode
}

/** How far the pointer must travel before we decide it's a horizontal swipe
 *  (anything more vertical than that is left to the page scroll). */
const AXIS_LOCK_PX = 8

interface DragState {
  pointerId: number
  x: number
  y: number
  base: number
  axis: 'x' | null
  lastX: number
  lastT: number
  velocity: number
}

/**
 * A phone list row that slides left to reveal its actions (Edit / Split /
 * Delete), snapping fully open or closed on release. Works with touch and
 * mouse via pointer events; `touch-action: pan-y` keeps vertical scrolling
 * native. The parent decides which row is open (one at a time); a tap
 * anywhere outside the open row closes it. For keyboard and screen-reader
 * users the same actions sit behind a "More actions" button, which is
 * visually hidden until focused.
 */
export function SwipeRow({ actions, open, onOpenChange, label, children }: SwipeRowProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const firstActionRef = useRef<HTMLButtonElement>(null)
  const drag = useRef<DragState | null>(null)
  const suppressClick = useRef(false)
  const focusActionsOnOpen = useRef(false)
  const [dragX, setDragX] = useState<number | null>(null)

  const width = actions.length * SWIPE_ACTION_WIDTH
  const swipeable = width > 0
  const offset = dragX ?? (open && swipeable ? -width : 0)
  const revealed = (open && swipeable) || dragX !== null

  // Tap (or start a swipe) anywhere outside this row closes it.
  useEffect(() => {
    if (!open) return
    const onDown = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open, onOpenChange])

  // Opened from the "More actions" button: move focus into the actions.
  useEffect(() => {
    if (open && focusActionsOnOpen.current) {
      focusActionsOnOpen.current = false
      firstActionRef.current?.focus()
    }
  }, [open])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!swipeable || (e.pointerType === 'mouse' && e.button !== 0)) return
    drag.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      base: offset,
      axis: null,
      lastX: e.clientX,
      lastT: e.timeStamp,
      velocity: 0,
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.axis) {
      if (Math.abs(dx) > AXIS_LOCK_PX && Math.abs(dx) > Math.abs(dy)) {
        d.axis = 'x'
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // Pointer already released -- the drag just ends on the next event.
        }
      } else if (Math.abs(dy) > AXIS_LOCK_PX) {
        drag.current = null // vertical: let the page scroll
        return
      } else {
        return
      }
    }
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.velocity = (e.clientX - d.lastX) / dt
    d.lastX = e.clientX
    d.lastT = e.timeStamp
    setDragX(dragOffset(d.base, dx, width))
  }

  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    if (d.axis === 'x') {
      suppressClick.current = true
      const current = dragOffset(d.base, e.clientX - d.x, width)
      const target = cancelled ? d.base : snapOffset(current, width, d.velocity)
      setDragX(null)
      onOpenChange(target !== 0)
    } else if (open && !cancelled) {
      // A plain tap on an open row closes it instead of acting on the row.
      suppressClick.current = true
      onOpenChange(false)
    }
  }

  const onActionsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onOpenChange(false)
      moreRef.current?.focus()
    }
  }

  return (
    <div ref={rootRef} className="relative overflow-hidden">
      {swipeable && (
        <div
          role="group"
          aria-label={`Actions for ${label}`}
          onKeyDown={onActionsKeyDown}
          className={clsx(
            'absolute inset-y-0 right-0 flex',
            // Hidden (and out of the tab order) while closed; stays visible
            // until the row has finished sliding shut.
            revealed ? 'visible [transition:visibility_0s]' : 'invisible [transition:visibility_0s_linear_320ms]'
          )}
          style={{ width }}
        >
          {actions.map((a, i) => (
            <button
              key={a.key}
              ref={i === 0 ? firstActionRef : undefined}
              type="button"
              onClick={() => {
                onOpenChange(false)
                a.onSelect()
              }}
              className={clsx(
                'flex h-full flex-col items-center justify-center gap-1 text-helper font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white',
                a.className
              )}
              style={{ width: SWIPE_ACTION_WIDTH }}
            >
              <a.icon size={16} aria-hidden="true" />
              {a.label}
            </button>
          ))}
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        className={clsx(
          'relative flex items-center bg-white touch-pan-y',
          dragX === null &&
            'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none'
        )}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
      >
        <div className="min-w-0 flex-1">{children}</div>
        {swipeable && (
          <button
            ref={moreRef}
            type="button"
            aria-label={`More actions for ${label}`}
            aria-expanded={open}
            onClick={() => {
              focusActionsOnOpen.current = !open
              onOpenChange(!open)
            }}
            className="sr-only mr-2 h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 focus-visible:not-sr-only focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
