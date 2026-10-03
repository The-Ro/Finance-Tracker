import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import type { NetWorthLine } from '@/lib/netWorth'

const LINE_LINKS: Partial<Record<NetWorthLine['key'], string>> = {
  accounts: '/settings/accounts',
  investments: '/goals',
  owedToYou: '/lent',
  cards: '/bills',
  loans: '/recurring',
  youOwe: '/lent',
}

function Lines({ title, lines, total, tone }: { title: string; lines: NetWorthLine[]; total: number; tone: 'own' | 'owe' }) {
  const { format } = useFormatCurrency()
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between border-b border-app-border pb-2">
        <span className="text-helper font-semibold uppercase tracking-wide text-slate-500">{title}</span>
        <span className={tone === 'own' ? 'font-semibold tabular-nums text-positive' : 'font-semibold tabular-nums text-danger'}>
          {format(total)}
        </span>
      </div>
      {lines.length === 0 ? (
        <p className="py-2.5 text-helper text-slate-500">Nothing here</p>
      ) : (
        <ul className="divide-y divide-app-border">
          {lines.map((l) => {
            const to = LINE_LINKS[l.key]
            const body = (
              <>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{l.label}</span>
                <span className="text-sm font-medium tabular-nums text-slate-900">{format(l.amount)}</span>
                {to && <ChevronRight size={15} className="shrink-0 text-slate-400" aria-hidden="true" />}
              </>
            )
            return (
              <li key={l.key}>
                {to ? (
                  <Link to={to} className="flex min-h-[44px] items-center gap-2 py-2 active:bg-slate-50">
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-h-[44px] items-center gap-2 py-2">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Settings -> Net worth: the worked-out figure and where each part comes from. */
export function NetWorthBreakdown() {
  const nw = useNetWorth()
  const { format } = useFormatCurrency()
  const shown = useAnimatedNumber(nw?.total ?? 0)
  if (!nw) return null
  return (
    <Card className="flex flex-col gap-5 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Your net worth</h3>
        <p className={`mt-1 font-serif text-3xl font-semibold tabular-nums ${nw.total < 0 ? 'text-danger' : 'text-slate-900'}`}>
          {format(shown)}
        </p>
        <p className="mt-1 text-helper text-slate-500">
          Worked out from your accounts, cards, investments, loans and money between you and others. It updates
          as you add entries. Investments count what you put in, not what they’re worth today.
        </p>
      </div>
      <Lines title="What you own" lines={nw.own} total={nw.ownTotal} tone="own" />
      <Lines title="What you owe" lines={nw.owe} total={nw.oweTotal} tone="owe" />
    </Card>
  )
}
