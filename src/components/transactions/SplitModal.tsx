import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { MoneyField } from '@/components/ui/MoneyField'
import { useApprovedConnections, useSplitMutations, useSplits } from '@/hooks/useSplits'
import { useProfiles } from '@/hooks/useProfiles'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { evenShare } from '@/lib/splits'
import type { Transaction } from '@/hooks/useTransactions'
import { FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'

interface SplitModalProps {
  transaction: Transaction | null
  onClose: () => void
}

/** Split one of your own expenses with a connected person: records what they owe you. */
export function SplitModal({ transaction, onClose }: SplitModalProps) {
  const { format } = useFormatCurrency()
  const connections = useApprovedConnections()
  const { data: profiles = {} } = useProfiles()
  const { data: splits = [] } = useSplits()
  const { create, remove } = useSplitMutations()
  const [personLabel, setPersonLabel] = useState('')
  const [amount, setAmount] = useState('')
  const errors = useFieldErrors<'person' | 'amount'>()

  // Label -> user id; the email disambiguates two people with the same name.
  const people = useMemo(
    () =>
      connections.map((id) => {
        const p = profiles[id]
        return { id, label: p ? `${p.displayName || p.email} (${p.email})` : 'Unknown user' }
      }),
    [connections, profiles]
  )
  const existing = transaction ? splits.filter((s) => s.transaction_id === transaction.id) : []

  useEffect(() => {
    if (!transaction) return
    setPersonLabel(people[0]?.label ?? '')
    setAmount(String(evenShare(transaction.amount)))
    errors.clear()
  }, [transaction]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!transaction) return null

  const handleSave = async () => {
    errors.clear()
    const person = people.find((p) => p.label === personLabel)
    const value = Number(amount)
    if (!person) return errors.fail('Choose who to split with.', 'person')
    if (!Number.isFinite(value) || value <= 0) return errors.fail('Enter the amount they owe.', 'amount')
    // Compared in cents so float sums like 33.33 + 33.33 + 33.34 don't trip it.
    const alreadySplitCents = existing.reduce((sum, s) => sum + Math.round(s.amount * 100), 0)
    const leftCents = Math.round(transaction.amount * 100) - alreadySplitCents
    if (Math.round(value * 100) > leftCents) {
      return errors.fail(
        alreadySplitCents > 0
          ? `Only ${format(Math.max(leftCents, 0) / 100)} of ${format(transaction.amount)} is left to split; ${format(alreadySplitCents / 100)} is already split.`
          : `Their share can't be more than ${format(transaction.amount)}.`,
        'amount'
      )
    }
    try {
      await create.mutateAsync({ transaction, withUserId: person.id, amount: value })
      onClose()
    } catch (e) {
      errors.fail(e instanceof Error ? e.message : 'Could not save this split.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Split expense"
      footer={
        people.length > 0 && (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Split'}
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={errors.general} />
        <p className="text-sm text-slate-600">
          {transaction.merchant} · {format(transaction.amount)}. You paid; the other person sees what they owe you on
          their Shared page.
        </p>

        {existing.length > 0 && (
          <ul className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 text-sm">
            {existing.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span className="text-slate-700">
                  {profiles[s.with_user_id]?.displayName ?? 'Someone'} owes {format(s.amount)}
                  {s.settled_at ? ' · settled' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate(s.id)}
                  className="min-h-[32px] text-helper font-medium text-danger hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {people.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            You can split with people you share with. Connect with someone in{' '}
            <Link to="/settings/sharing"onClick={onClose} className="font-medium text-accent-dark underline">
              Settings, Sharing
            </Link>{' '}
            first.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-helper font-medium text-slate-600">Split with</label>
              <Dropdown
                options={people.map((p) => p.label)}
                value={personLabel}
                error={errors.on('person')}
                onChange={(e) => setPersonLabel(e.target.value)}
                aria-label="Split with"
              />
            </div>
            <MoneyField
              label="They owe you"
              error={errors.on('amount')}
              value={amount}
              onChange={setAmount}
            />
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmount(String(evenShare(transaction.amount, n)))}
                  className="min-h-[44px] rounded-full border border-app-border px-3 text-helper font-medium text-slate-600 hover:border-accent hover:text-accent-dark"
                >
                  1/{n}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
