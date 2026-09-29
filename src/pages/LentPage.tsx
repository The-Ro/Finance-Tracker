import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, HandCoins, Send } from 'lucide-react'
import { PageHeader, PageHeaderAction } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { IouFormModal } from '@/components/lent/IouFormModal'
import { RepayModal } from '@/components/lent/RepayModal'
import { useIous, type Iou } from '@/hooks/useIous'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { useToast } from '@/context/ToastContext'
import { formatShortDate, todayISO } from '@/lib/format'
import { reminderText, summarizeIous, type IouLine, type IouPerson } from '@/lib/ious'
import { shareText } from '@/lib/share'
import type { IouDirection } from '@/types/database.types'

/**
 * Lent & borrowed: money you lent someone or borrowed from them, grouped by
 * person, with part or full repayments. Private to you; it tracks who owes
 * what and doesn't move money between accounts.
 */
export function LentPage() {
  const { data, isLoading, remove } = useIous()
  const { format } = useFormatCurrency()
  const { show } = useToast()
  const [form, setForm] = useState<{ open: boolean; editing: Iou | null; direction: IouDirection }>({
    open: false,
    editing: null,
    direction: 'lent',
  })
  const [repaying, setRepaying] = useState<IouLine | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Iou | null>(null)

  const records = useMemo(() => data?.records ?? [], [data])
  const payments = useMemo(() => data?.payments ?? [], [data])
  const summary = useMemo(() => summarizeIous(records, payments, todayISO()), [records, payments])
  const owedToYou = useAnimatedNumber(summary.owedToYou)
  const youOwe = useAnimatedNumber(summary.youOwe)
  const peopleNames = useMemo(() => summary.people.map((p) => p.person), [summary])

  const openNew = (direction: IouDirection) => setForm({ open: true, editing: null, direction })
  const openEdit = (id: string) => {
    const record = records.find((r) => r.id === id)
    if (record) setForm({ open: true, editing: record, direction: record.direction })
  }

  const remind = async (p: IouPerson) => {
    const lent = p.open.filter((l) => l.direction === 'lent')
    const result = await shareText('Reminder', reminderText(p.person, p.net, lent, format))
    if (result === 'copied') show('Reminder copied. Paste it in a message.', { tone: 'success' })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    remove.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
      onError: () => {
        setPendingDelete(null)
        show('Couldn’t delete that. Try again.', { tone: 'error' })
      },
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Lent & borrowed" actions={<PageHeaderAction label="New" onClick={() => openNew('lent')} />} />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[92px] w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Nothing lent or borrowed yet"
          description="Keep track of money you lend to friends and family, or borrow from them, and who has paid back."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => openNew('lent')}
                className="press min-h-[44px] rounded-xl bg-accent px-4 text-sm font-semibold text-white"
              >
                I lent money
              </button>
              <button
                type="button"
                onClick={() => openNew('borrowed')}
                className="press min-h-[44px] rounded-xl border border-app-border px-4 text-sm font-semibold text-slate-700"
              >
                I borrowed money
              </button>
            </div>
          }
        />
      ) : (
        <>
          <div className="animate-fade-in-up grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => openNew('lent')}
              className="flex min-w-0 flex-col gap-1 rounded-card bg-positive-light p-3.5 text-left active:scale-[0.98]"
            >
              <span className="text-helper font-bold text-positive">People owe you</span>
              <span className="truncate font-serif text-xl font-semibold tabular-nums text-slate-900">{format(owedToYou)}</span>
              <span className="text-xs font-medium text-slate-500">+ I lent money</span>
            </button>
            <button
              type="button"
              onClick={() => openNew('borrowed')}
              className="flex min-w-0 flex-col gap-1 rounded-card bg-danger-light p-3.5 text-left active:scale-[0.98]"
            >
              <span className="text-helper font-bold text-danger">You owe</span>
              <span className="truncate font-serif text-xl font-semibold tabular-nums text-slate-900">{format(youOwe)}</span>
              <span className="text-xs font-medium text-slate-500">+ I borrowed money</span>
            </button>
          </div>

          <ul className="stagger-rows flex flex-col gap-3">
            {summary.people.map((p) => (
              <PersonCard
                key={p.person.toLowerCase()}
                person={p}
                onRepay={setRepaying}
                onEdit={openEdit}
                onRemind={() => remind(p)}
              />
            ))}
          </ul>
          <p className="text-center text-helper text-slate-500">
            Only you can see this. It keeps track of who owes what and doesn’t change your account balances.
          </p>
        </>
      )}

      <IouFormModal
        open={form.open}
        editing={form.editing}
        initialDirection={form.direction}
        people={peopleNames}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onDelete={
          form.editing
            ? () => {
                setPendingDelete(form.editing)
                setForm((f) => ({ ...f, open: false }))
              }
            : undefined
        }
      />
      <RepayModal line={repaying} payments={payments} onClose={() => setRepaying(null)} />
      <ConfirmDeleteModal
        open={pendingDelete !== null}
        title="Delete this record"
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      >
        <p>
          Delete {pendingDelete ? format(pendingDelete.amount) : ''} {pendingDelete?.direction === 'lent' ? 'lent to' : 'borrowed from'}{' '}
          <span className="font-medium">{pendingDelete?.person}</span> and its paybacks? This can’t be undone.
        </p>
      </ConfirmDeleteModal>
    </div>
  )
}

function PersonCard({
  person,
  onRepay,
  onEdit,
  onRemind,
}: {
  person: IouPerson
  onRepay: (line: IouLine) => void
  onEdit: (id: string) => void
  onRemind: () => void
}) {
  const { format } = useFormatCurrency()
  const [showSettled, setShowSettled] = useState(false)
  const initial = person.person.charAt(0).toUpperCase()

  return (
    <li>
      <Card className="flex flex-col gap-1 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-light font-semibold text-accent-on-light"
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{person.person}</p>
            <p
              className={clsx(
                'text-helper font-medium',
                person.net > 0 ? 'text-positive' : person.net < 0 ? 'text-danger' : 'text-slate-500'
              )}
            >
              {person.net > 0
                ? `Owes you ${format(person.net)}`
                : person.net < 0
                  ? `You owe ${format(-person.net)}`
                  : 'All settled'}
            </p>
          </div>
          {person.net > 0 && (
            <button
              type="button"
              onClick={onRemind}
              className="press inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-app-border px-3 text-helper font-semibold text-slate-700"
            >
              <Send size={13} aria-hidden="true" /> Remind
            </button>
          )}
        </div>

        {person.open.length > 0 && (
          <ul className="stagger-rows-soft flex flex-col divide-y divide-app-border">
            {person.open.map((line) => (
              <IouRow key={line.id} line={line} onRepay={() => onRepay(line)} onEdit={() => onEdit(line.id)} />
            ))}
          </ul>
        )}

        {person.settled.length > 0 && (
          <div className="border-t border-app-border pt-1">
            <button
              type="button"
              aria-expanded={showSettled}
              onClick={() => setShowSettled((s) => !s)}
              className="flex min-h-[36px] w-full items-center gap-1 text-helper font-medium text-slate-500"
            >
              {person.settled.length} paid back
              <ChevronDown size={14} className={clsx('transition-transform', showSettled && 'rotate-180')} aria-hidden="true" />
            </button>
            {showSettled && (
              <ul className="animate-fade-in flex flex-col divide-y divide-app-border opacity-70">
                {person.settled.map((line) => (
                  <IouRow key={line.id} line={line} onEdit={() => onEdit(line.id)} />
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </li>
  )
}

function IouRow({ line, onRepay, onEdit }: { line: IouLine; onRepay?: () => void; onEdit: () => void }) {
  const { format } = useFormatCurrency()
  const lent = line.direction === 'lent'
  return (
    <li className="flex items-start gap-3 py-2.5">
      <button type="button" onClick={onEdit} className="press flex min-w-0 flex-1 flex-col gap-1 rounded-lg text-left">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-slate-700">
            <span className={clsx('font-semibold', lent ? 'text-positive' : 'text-danger')}>{lent ? 'Lent' : 'Borrowed'}</span>{' '}
            {format(line.amount)} · {formatShortDate(line.date)}
          </span>
        </span>
        {line.note && <span className="truncate text-helper text-slate-500">{line.note}</span>}
        {line.settled ? (
          <span className="text-helper text-slate-500">
            Paid back{line.lastPaid ? ` on ${formatShortDate(line.lastPaid)}` : ''}
          </span>
        ) : (
          <>
            {line.paid > 0 && (
              <span className="flex flex-col gap-1">
                <ProgressBar percent={(line.paid / line.amount) * 100} tone="positive" />
                <span className="text-helper text-slate-500">
                  {format(line.paid)} back · {format(line.left)} left
                </span>
              </span>
            )}
            {line.due_date && (
              <span className={clsx('text-helper', line.overdue ? 'font-semibold text-caution' : 'text-slate-500')}>
                {line.overdue ? `Was due ${formatShortDate(line.due_date)}` : `Pay back by ${formatShortDate(line.due_date)}`}
              </span>
            )}
          </>
        )}
      </button>
      {onRepay && !line.settled && (
        <button
          type="button"
          onClick={onRepay}
          className="press mt-0.5 inline-flex min-h-[36px] shrink-0 items-center rounded-full bg-accent-light px-3 text-helper font-semibold text-accent-on-light"
        >
          {lent ? 'Got paid back' : 'Paid back'}
        </button>
      )}
    </li>
  )
}
