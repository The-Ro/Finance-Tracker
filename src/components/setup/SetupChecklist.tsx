import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  Check,
  ChevronRight,
  FileUp,
  Landmark,
  PiggyBank,
  Receipt,
  Target,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { SalarySettings } from '@/components/settings/SalarySettings'
import { useAuth } from '@/context/AuthContext'
import { useGlobalModals } from '@/context/GlobalModalsContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useMyTransactions } from '@/hooks/useTransactions'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { useAccountKinds } from '@/hooks/useCards'
import { useRecurringItemsRaw } from '@/hooks/useRecurring'
import { useBudgets } from '@/hooks/useBudgets'
import { useGoals } from '@/hooks/useGoals'
import { useOwnedAccessRows, useRequestedAccessRows } from '@/hooks/useSharing'
import { setupChecklist, type SetupItemId } from '@/lib/setupChecklist'
import { BillPicksModal } from './BillPicksModal'
import { BudgetSuggestionsModal } from './BudgetSuggestionsModal'

const COPY: Record<SetupItemId, { title: string; hint: string; icon: LucideIcon }> = {
  accounts: { title: 'Add your accounts and cards', hint: 'Banks, cards and wallets with today’s balance', icon: Landmark },
  salary: { title: 'Set your salary day', hint: 'On pay day we ask if it came in, and log it', icon: Wallet },
  bills: { title: 'Add your regular bills', hint: 'Rent, EMIs, phone, subscriptions: one tap each', icon: Receipt },
  budget: { title: 'Set a monthly budget', hint: 'Limits suggested from your spending', icon: PiggyBank },
  goal: { title: 'Start a savings goal', hint: 'An emergency fund, a trip, anything', icon: Target },
  import: { title: 'Import a bank statement', hint: 'Bring in past transactions from a CSV file', icon: FileUp },
  share: { title: 'Share with family', hint: 'Invite someone by email to see each other’s spending', icon: Users },
}

/**
 * Home's "Finish setting up" card, after the short welcome wizard: what's
 * left, ticked off from the user's own data, each row one tap from doing it.
 * Hidden once everything is done, or when the user hides it
 * (user_settings.setup_checklist_dismissed).
 */
export function SetupChecklist() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { openImport } = useGlobalModals()
  const settings = useUserSettings()
  const transactions = useMyTransactions(userId)
  const { inUse, ready } = useAccountsInUse()
  const kinds = useAccountKinds()
  const recurring = useRecurringItemsRaw()
  const budgets = useBudgets()
  const goals = useGoals()
  const owned = useOwnedAccessRows()
  const requested = useRequestedAccessRows()
  const [sheet, setSheet] = useState<'bills' | 'budget' | 'salary' | null>(null)

  const loaded =
    ready && recurring.data && budgets.data && goals.data && owned.data && requested.data && transactions.data && settings.data

  const state = useMemo(
    () =>
      setupChecklist({
        hasAccounts: [...inUse].some((name) => kinds.get(name) !== 'cash'),
        hasSalary: !!settings.data?.salary,
        hasBills: (recurring.data ?? []).length > 0,
        hasBudget: (budgets.data ?? []).length > 0,
        hasGoal: (goals.data ?? []).length > 0,
        hasImport: (transactions.data ?? []).some((t) => t.source === 'csv'),
        hasSharing: (owned.data ?? []).length + (requested.data ?? []).length > 0,
      }, {
        dismissed: settings.data?.setupChecklistDismissed ?? false,
        version: settings.data?.setupChecklistVersion ?? 1,
      }),
    [inUse, kinds, recurring.data, budgets.data, goals.data, transactions.data, owned.data, requested.data, settings.data]
  )

  const modals = (
    <>
      <BillPicksModal open={sheet === 'bills'} onClose={() => setSheet(null)} />
      <BudgetSuggestionsModal open={sheet === 'budget'} onClose={() => setSheet(null)} />
      <Modal open={sheet === 'salary'} onClose={() => setSheet(null)} title="Salary day">
        <SalarySettings bare onSaved={() => setSheet(null)} />
      </Modal>
    </>
  )

  if (!loaded || !settings.data?.onboardingCompleted || !state.visible) {
    // Keep a sheet mounted if it's open (finishing the last item closes the card).
    return sheet ? modals : null
  }

  const act = (id: SetupItemId) => {
    if (id === 'accounts') navigate('/settings/accounts')
    else if (id === 'salary') setSheet('salary')
    else if (id === 'bills') setSheet('bills')
    else if (id === 'budget') setSheet('budget')
    else if (id === 'goal') navigate('/goals')
    else if (id === 'import') openImport()
    else navigate('/friends')
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Finish setting up</h3>
          <p className="text-helper text-slate-500">
            {state.done} of {state.total} done
          </p>
        </div>
        <button
          type="button"
          aria-label="Hide setup checklist"
          onClick={() => settings.dismissSetupChecklist.mutate()}
          className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X size={16} />
        </button>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div
          className="animate-bar-grow h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none dark:bg-accent-dark"
          style={{ width: `${(state.done / state.total) * 100}%` }}
        />
      </div>
      <ul className="stagger-rows flex flex-col">
        {state.items.map(({ id, done, isNew }) => {
          const { title, hint, icon: Icon } = COPY[id]
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => act(id)}
                className="-mx-2 flex min-h-[56px] w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 text-left hover:bg-slate-50"
              >
                <span
                  className={clsx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    done ? 'animate-pop-in bg-positive-light text-positive' : 'bg-accent-light text-accent-on-light'
                  )}
                >
                  {done ? <Check size={17} strokeWidth={3} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={clsx('truncate text-sm font-semibold', done ? 'text-slate-500 line-through' : 'text-slate-900')}>
                      {title}
                    </span>
                    {isNew && !done && (
                      <span className="shrink-0 rounded-full bg-brass-light px-1.5 text-xs font-bold text-brass">New</span>
                    )}
                  </span>
                  <span className="truncate text-helper text-slate-500">{done ? 'Done' : hint}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
      {modals}
    </Card>
  )
}
