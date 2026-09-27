import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useGoals, type Goal } from '@/hooks/useGoals'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { addToGoal, parseDeposit } from '@/lib/goals'

interface AddMoneyModalProps {
  goal: Goal | null
  onClose: () => void
}

/**
 * Puts money toward a goal: adds the entered amount to its saved total via
 * useGoals().update (the same path the Edit form uses). It only moves the
 * goal's number -- it doesn't log a transaction or touch any account balance.
 */
export function AddMoneyModal({ goal, onClose }: AddMoneyModalProps) {
  const { update } = useGoals()
  const { format } = useFormatCurrency()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset per goal opened, not on every refetch of the same goal.
  const goalId = goal?.id
  useEffect(() => {
    if (!goalId) return
    setAmount('')
    setError(null)
  }, [goalId])

  if (!goal) return null

  const remaining = Math.max(0, goal.target_amount - goal.current_amount)
  const deposit = parseDeposit(amount)
  const after = deposit === null ? null : addToGoal(goal.current_amount, deposit)

  const handleSave = async () => {
    setError(null)
    if (deposit === null) return setError('Enter an amount above zero.')
    try {
      await update.mutateAsync({ id: goal.id, currentAmount: addToGoal(goal.current_amount, deposit) })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add money to this goal.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add money to ${goal.name}`}
      maxWidthClassName="max-w-sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Add money'}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
      >
        <p className="text-sm text-slate-600">
          <span className="tabular-nums">{format(goal.current_amount)}</span> saved of{' '}
          <span className="tabular-nums">{format(goal.target_amount)}</span>
          {remaining > 0 && (
            <>
              {' '}
              · <span className="tabular-nums">{format(remaining)}</span> to go
            </>
          )}
          .
        </p>
        <TextField
          label="Amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setAmount(String(Math.round(remaining * 100) / 100))}
            className="min-h-[44px] self-start rounded-lg px-1 text-sm font-medium text-accent-dark hover:underline"
          >
            Fill the rest ({format(remaining)})
          </button>
        )}
        {after !== null && (
          <p className="text-helper text-slate-500">
            New total: <span className="font-medium tabular-nums text-slate-700">{format(after)}</span>
            {after >= goal.target_amount && ' · goal reached'}
          </p>
        )}
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
      </form>
    </Modal>
  )
}
