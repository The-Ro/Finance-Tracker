import { useMemo, useState } from 'react'
import { Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useAddTransaction, useMyTransactions } from '@/hooks/useTransactions'
import { useCategories, useTags } from '@/hooks/useLookupLists'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { SALARY_TAG, salaryPromptDue } from '@/lib/salary'
import { parseBalance } from '@/lib/onboardingAccounts'
import { todayISO } from '@/lib/format'

const SNOOZE_KEY = 'ledgeeaze:salary-snoozed'

function snoozedToday(today: string): boolean {
  try {
    return localStorage.getItem(SNOOZE_KEY) === today
  } catch {
    return false
  }
}

/**
 * Home's payday question: "Did your salary arrive in HDFC Bank?" from pay
 * day on each month (salaryPromptDue). Yes logs it as income (category
 * Salary, tag #salary) at the amount shown, which can be changed first; Not
 * yet asks again tomorrow (per browser). Logging it with #salary any other way
 * also counts.
 */
export function SalaryPrompt() {
  const { userId } = useAuth()
  const settings = useUserSettings()
  const { data: transactions } = useMyTransactions(userId)
  const { income: incomeCategories } = useCategories()
  const { data: tags = [], add: addTag } = useTags()
  const addTransaction = useAddTransaction()
  const { format } = useFormatCurrency()
  const { show } = useToast()
  const today = todayISO()
  const [snoozed, setSnoozed] = useState(() => snoozedToday(today))
  const salary = settings.data?.salary ?? null
  const [amount, setAmount] = useState('')

  const due = useMemo(() => {
    if (!transactions) return null
    const month = today.slice(0, 7)
    const logged = transactions.some((t) => t.type === 'income' && t.date.startsWith(month) && t.tags.includes(SALARY_TAG))
    return salaryPromptDue(salary, today, logged)
  }, [salary, transactions, today])

  if (!due || !salary || snoozed) return null

  const shown = amount === '' ? String(salary.amount) : amount
  const confirm = async () => {
    const value = parseBalance(shown)
    if (value === null || value <= 0) return show('Enter the amount that arrived.', { tone: 'error' })
    try {
      if (!tags.includes(SALARY_TAG)) await addTag.mutateAsync(SALARY_TAG)
      await addTransaction.mutateAsync({
        date: today,
        merchant: 'Salary',
        category: incomeCategories.includes('Salary') ? 'Salary' : (incomeCategories[0] ?? null),
        amount: value,
        type: 'income',
        account: salary.account,
        tags: [SALARY_TAG],
        receipt: false,
        allowDuplicate: true,
      })
      await settings.markSalaryAnswered.mutateAsync(due.month)
      show(`Logged ${format(value)} salary in ${salary.account}.`)
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not log the salary.', { tone: 'error' })
    }
  }
  const notYet = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, today)
    } catch {
      // Private mode: it just asks again next time Home opens.
    }
    setSnoozed(true)
  }

  return (
    <Card className="animate-fade-in-up flex flex-col gap-3 border-positive/30 bg-positive-light p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-positive">
          <Wallet size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Payday! Did your salary arrive in {salary.account}?</p>
          <p className="text-helper text-slate-600">Yes logs it as income with the tag #{SALARY_TAG}. Change the amount first if it's different.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-app-border bg-white px-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
          <span className="text-helper text-slate-500">Amount</span>
          <input
            inputMode="decimal"
            value={shown}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Salary amount received"
            className="min-h-[40px] min-w-0 flex-1 bg-transparent text-right text-sm font-semibold tabular-nums focus:outline-none"
          />
        </label>
        <Button onClick={confirm} disabled={addTransaction.isPending || settings.markSalaryAnswered.isPending}>
          {addTransaction.isPending ? 'Logging…' : 'Yes, log it'}
        </Button>
        <Button variant="secondary" onClick={notYet}>
          Not yet
        </Button>
      </div>
    </Card>
  )
}
