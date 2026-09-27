import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { monthEndBalances } from '@/lib/balanceHistory'
import { sparklinePath } from '@/lib/home'
import { todayISO } from '@/lib/format'
import { cashAndCardDebt } from '@/lib/creditCards'
import { useAccountKinds, useClosedAccounts } from '@/hooks/useCards'

const DEFAULT_SPARK_WIDTH = 320
const SPARK_HEIGHT = 56

interface BalanceHeroCardProps {
  transactions: { type: string; date: string; amount: number }[]
  /** Per-account balances (useAccountBalances). */
  balances: Map<string, number>
  /** Per-account starting balances (useAccountOpeningBalances). */
  openingBalances: Map<string, number> | undefined
}

/**
 * Home's headline number: the total across every account (starting balances
 * plus logged transactions -- same source as Account balances), how much it
 * moved this month, and a 6-month sparkline of month-end totals that draws
 * itself in. Distinct from the manual Net worth card, which is typed in.
 */
export function BalanceHeroCard({ transactions, balances, openingBalances }: BalanceHeroCardProps) {
  const { format } = useFormatCurrency()
  // Net of card debt (card balances are negative when owed); the split into
  // cash in accounts vs owed on cards is shown underneath when there's debt.
  const kinds = useAccountKinds()
  const closed = useClosedAccounts()
  const { cash, cardDebt, net: total } = useMemo(() => cashAndCardDebt(new Map([...balances].filter(([n]) => !closed.has(n))), kinds), [balances, kinds, closed])

  const history = useMemo(() => {
    const openingTotal = [...(openingBalances?.values() ?? [])].reduce((sum, v) => sum + v, 0)
    return monthEndBalances(transactions, openingTotal, 6, todayISO())
  }, [transactions, openingBalances])
  const change = history.length >= 2 ? history[history.length - 1].total - history[history.length - 2].total : 0
  // Drawn in real pixels (measured) rather than a stretched viewBox, so the
  // stroke keeps its width at any card size.
  const sparkRef = useRef<SVGSVGElement>(null)
  const [sparkWidth, setSparkWidth] = useState(DEFAULT_SPARK_WIDTH)
  useEffect(() => {
    const el = sparkRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width)
      if (width > 0) setSparkWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const path = useMemo(
    () => sparklinePath(history.map((h) => h.total), sparkWidth, SPARK_HEIGHT, 6),
    [history, sparkWidth]
  )

  // useAnimatedNumber starts at whatever it's first given; start it at 0 and
  // hand it the real total after mount so the figure counts up on arrival.
  // The same flag flips the sparkline's dash offset so it draws in.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const animatedTotal = useAnimatedNumber(mounted ? total : 0, 1200)

  const accountCount = balances.size
  const hasActivity = accountCount > 0

  return (
    <Card className="relative flex flex-col gap-1.5 overflow-hidden border-accent/30 bg-accent-light p-5 pb-0 sm:p-6 sm:pb-0">
      <span className="text-helper font-semibold uppercase tracking-[0.12em] text-accent-on-light/80">Total balance</span>
      <span className="font-serif text-4xl font-semibold leading-tight tabular-nums text-accent-on-light sm:text-5xl">
        <span className="sr-only">{format(total)}</span>
        <span aria-hidden="true">{format(animatedTotal)}</span>
      </span>
      {hasActivity ? (
        <span className={clsx('text-sm font-semibold tabular-nums', change < 0 ? 'text-danger' : 'text-positive')}>
          {change >= 0 ? '+' : '−'}
          {format(Math.abs(change))} this month
          <span className="font-medium text-accent-on-light/70">
            {' '}
            · across {accountCount} account{accountCount === 1 ? '' : 's'}
          </span>
        </span>
      ) : null}
      {hasActivity && cardDebt > 0 && (
        <span className="text-helper tabular-nums text-accent-on-light/80">
          {format(cash)} in accounts · {format(cardDebt)} owed on cards
        </span>
      )}
      {!hasActivity && (
        <span className="text-sm text-accent-on-light/80">
          Log an entry or set{' '}
          <Link to="/settings#starting-balances" className="font-semibold underline-offset-2 hover:underline">
            starting balances
          </Link>{' '}
          to see your total.
        </span>
      )}
      <svg
        ref={sparkRef}
        viewBox={`0 0 ${sparkWidth} ${SPARK_HEIGHT}`}
        className="-mx-5 mt-2 block h-14 w-[calc(100%+2.5rem)] text-accent-on-light sm:-mx-6 sm:w-[calc(100%+3rem)]"
        fill="none"
        role="img"
        aria-label={`Month-end total balance over the last ${history.length} months`}
      >
        {path && (
          <path
            d={path}
            stroke="currentColor"
            strokeOpacity={0.75}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={mounted ? 0 : 1}
            className="transition-[stroke-dashoffset] delay-200 duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          />
        )}
      </svg>
    </Card>
  )
}
