import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { HERO_COUNT_UP_MS, useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { useAccountKinds, useCardStatuses, useClosedAccounts } from '@/hooks/useCards'
import { cashAndCardDebt } from '@/lib/creditCards'
import { cardLimitTotals } from '@/lib/cardSummary'
import type { SavingsHeadline } from '@/lib/savings'

interface HomeTilesProps {
  /** Per-account balances (useAccountBalances); closed accounts are dropped here. */
  balances: Map<string, number>
  /** This month's savings (savingsHeadline over monthlySavings). */
  saved: SavingsHeadline
}

/** How many account names "In your accounts" lists before "+N more". */
const MAX_NAMES = 4

/** A figure that counts up from zero when it first appears (straight to the value under reduced motion). */
function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const shown = useAnimatedNumber(mounted ? value : 0, HERO_COUNT_UP_MS)
  return (
    <span className={clsx('font-serif text-2xl font-semibold leading-tight tabular-nums sm:text-[2rem]', className)}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  )
}

function Tile({
  label,
  children,
  footer,
  tinted,
  className,
}: {
  label: string
  children: ReactNode
  footer: ReactNode
  tinted?: boolean
  className?: string
}) {
  return (
    <Card
      className={clsx(
        'flex min-w-0 flex-col gap-1 p-4 sm:p-5',
        tinted && 'border-accent/30 bg-accent-light',
        className
      )}
    >
      <span
        className={clsx(
          'text-helper font-semibold uppercase tracking-[0.12em]',
          tinted ? 'text-accent-on-light/80' : 'text-slate-500'
        )}
      >
        {label}
      </span>
      {children}
      <span className={clsx('text-helper', tinted ? 'text-accent-on-light/80' : 'text-slate-500')}>{footer}</span>
    </Card>
  )
}

/**
 * Home's three headline tiles, in place of the old single "Total balance"
 * (which netted card debt against cash and read as a confusing negative):
 * money in bank/cash/wallet accounts, what's owed on credit cards, and what
 * was saved this month. Closed accounts are left out of every figure.
 */
export function HomeTiles({ balances, saved }: HomeTilesProps) {
  const { format } = useFormatCurrency()
  const kinds = useAccountKinds()
  const closed = useClosedAccounts()
  const cards = useCardStatuses()

  const open = useMemo(() => new Map([...balances].filter(([name]) => !closed.has(name))), [balances, closed])
  const { cash, cardDebt } = useMemo(() => cashAndCardDebt(open, kinds), [open, kinds])

  // Named accounts that hold money, biggest first, for the tile's footer.
  const cashNames = useMemo(
    () =>
      [...open]
        .filter(([name, balance]) => kinds.get(name) !== 'credit_card' && balance !== 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name),
    [open, kinds]
  )
  const limits = useMemo(
    () =>
      cardLimitTotals(
        [...cards]
          .filter(([name]) => !closed.has(name))
          .map(([, s]) => ({ owed: s.owed, limit: s.available != null ? s.available + s.owed : null }))
      ),
    [cards, closed]
  )

  const cashFooter =
    cashNames.length === 0 ? (
      <>
        Set{' '}
        <Link to="/settings#starting-balances" className="font-semibold text-accent-dark hover:underline">
          starting balances
        </Link>{' '}
        to see this
      </>
    ) : (
      <span className="block truncate" title={cashNames.join(' · ')}>
        {cashNames.slice(0, MAX_NAMES).join(' · ')}
        {cashNames.length > MAX_NAMES ? ` · +${cashNames.length - MAX_NAMES} more` : ''}
      </span>
    )

  const cardFooter =
    cards.size === 0 ? (
      <>
        No credit cards ·{' '}
        <Link to="/settings#account-types" className="font-semibold text-accent-dark hover:underline">
          add one
        </Link>
      </>
    ) : limits.percent !== null ? (
      `${Math.round(limits.percent)}% of ${format(limits.limit)} total limit`
    ) : (
      `Across ${cards.size} card${cards.size === 1 ? '' : 's'}`
    )

  const savedFooter =
    saved.rate === null
      ? 'No income logged this month yet'
      : `${Math.round(saved.rate)}% of ${format(saved.income)} income${saved.isBest ? ' · best in 6 months' : ''}`

  return (
    <div className="stagger-rows grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      <Tile label="In your accounts" footer={cashFooter}>
        <CountUp value={cash} format={format} className={cash < 0 ? 'text-danger' : 'text-positive'} />
      </Tile>
      <Tile label="Owed on cards" footer={cardFooter}>
        <CountUp value={cardDebt} format={format} className={cardDebt > 0 ? 'text-danger' : 'text-slate-900'} />
      </Tile>
      <Tile label="Saved this month" footer={savedFooter} tinted className="col-span-2 lg:col-span-1">
        <CountUp
          value={saved.saved}
          format={(n) => (n < 0 ? `−${format(Math.abs(n))}` : format(n))}
          className={saved.saved < 0 ? 'text-danger' : 'text-accent-on-light'}
        />
      </Tile>
    </div>
  )
}
