import { useState } from 'react'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { useUpdateTransaction, type Transaction } from '@/hooks/useTransactions'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useToast } from '@/context/ToastContext'
import { toCardPaymentUpdate, type CardPaymentSuggestion } from '@/lib/cardPayments'
import { formatShortDate } from '@/lib/format'

const STORAGE_KEY = 'ledgeeaze:card-payment-dismissed'
const PICK_CARD = 'Which card?'
const COLLAPSED_COUNT = 2

function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Private mode / storage blocked: dismissals just last until reload.
  }
}

interface CardPaymentNoticeProps {
  suggestions: CardPaymentSuggestion<Transaction>[]
  /** Every credit card, for picking one when a suggestion has no confident match. */
  cardAccounts: string[]
  className?: string
}

/**
 * Card bills paid from a bank account but logged as expenses are counted twice
 * (the card purchases already are). Offers to turn each into a transfer to the
 * card. "Not a bill" hides one for this browser session.
 */
export function CardPaymentNotice({ suggestions, cardAccounts, className }: CardPaymentNoticeProps) {
  const [dismissed, setDismissed] = useState(readDismissed)
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const updateTransaction = useUpdateTransaction()
  const { format } = useFormatCurrency()
  const { show } = useToast()

  const visible = suggestions.filter((s) => !dismissed.has(s.transaction.id))
  if (visible.length === 0) return null
  const shown = expanded ? visible : visible.slice(0, COLLAPSED_COUNT)

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id)
    setDismissed(next)
    writeDismissed(next)
  }

  const convert = async (t: Transaction, card: string) => {
    setPendingId(t.id)
    try {
      await updateTransaction.mutateAsync(toCardPaymentUpdate(t, card))
      show(`Now a payment to ${card}`, { tone: 'success' })
    } catch (e) {
      show(e instanceof Error ? e.message : "Couldn't convert that entry. Try again.", { tone: 'error' })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Card className={'animate-fade-in-up flex flex-col gap-2.5 border-caution/40 bg-caution-light p-3.5 ' + (className ?? '')}>
      <div className="flex gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-caution" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">
            {visible.length === 1 ? 'Card bill counted as spending?' : `${visible.length} card bills counted as spending?`}
          </h3>
          <p className="text-helper text-slate-600">
            Paying a card bill is a transfer to the card. Logged as an expense, it's counted twice.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {shown.map(({ transaction: t, card, reason }) => {
          const chosen = card ?? picked[t.id] ?? ''
          const busy = pendingId === t.id
          return (
            <li key={t.id} className="flex flex-col gap-2 rounded-xl bg-app-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900" title={t.merchant}>
                    {t.merchant}
                  </p>
                  <p className="flex min-w-0 items-center gap-1 text-helper text-slate-500">
                    <span className="shrink-0">{formatShortDate(t.date)} ·</span>
                    <span className="truncate">{t.account}</span>
                    {card && (
                      <>
                        <ArrowRight size={12} className="shrink-0" aria-label="to" />
                        <span className="truncate">{card}</span>
                      </>
                    )}
                  </p>
                  {!card && <p className="text-helper text-slate-500">{reason}. Pick the card it paid.</p>}
                </div>
                <span className="shrink-0 font-serif text-base font-semibold tabular-nums text-slate-900">{format(t.amount)}</span>
              </div>
              {!card && (
                <Dropdown
                  options={[PICK_CARD, ...cardAccounts]}
                  value={picked[t.id] ?? PICK_CARD}
                  aria-label={`Card paid by ${t.merchant}`}
                  onChange={(e) => setPicked((p) => ({ ...p, [t.id]: e.target.value === PICK_CARD ? '' : e.target.value }))}
                />
              )}
              <div className="flex gap-2">
                <Button onClick={() => convert(t, chosen)} disabled={!chosen || busy} className="flex-1 sm:flex-none">
                  {busy ? 'Converting…' : 'Convert to card payment'}
                </Button>
                <Button variant="secondary" onClick={() => dismiss(t.id)} disabled={busy} className="shrink-0">
                  Not a bill
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {!expanded && visible.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-[44px] self-start text-helper font-semibold text-accent-dark hover:underline"
        >
          Show {visible.length - COLLAPSED_COUNT} more
        </button>
      )}
    </Card>
  )
}
