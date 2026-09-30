import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Check, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { TextField } from '@/components/ui/TextField'
import { FormError } from '@/components/ui/FieldError'
import { useFieldErrors } from '@/hooks/useFieldErrors'
import { useToast } from '@/context/ToastContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { useAccounts } from '@/hooks/useLookupLists'
import { useAccountKinds } from '@/hooks/useCards'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { parseBalance } from '@/lib/onboardingAccounts'
import { LAST_DAY, payDayLabel, shortMonthNote } from '@/lib/salary'

const PICK = 'Choose an account'

/**
 * Settings -> Salary: amount, the account it's paid into and the pay day.
 * On pay day Home asks whether it arrived (SalaryPrompt).
 * `bare` drops the card and heading (the welcome setup and Home checklist use it).
 */
export function SalarySettings({ bare, onSaved }: { bare?: boolean; onSaved?: () => void } = {}) {
  const settings = useUserSettings()
  const { data: accounts = [] } = useAccounts()
  const { inUse } = useAccountsInUse()
  const kinds = useAccountKinds()
  const { format } = useFormatCurrency()
  const { show } = useToast()
  const salary = settings.data?.salary ?? null
  // Salary lands in a bank, cash or wallet account -- not a credit card.
  const options = accounts.filter((a) => kinds.get(a) !== 'credit_card' && (inUse.has(a) || a === salary?.account))

  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState(PICK)
  const [day, setDay] = useState('')
  const errors = useFieldErrors<'amount' | 'account' | 'day'>()

  useEffect(() => {
    if (!salary) return
    setAmount(String(salary.amount))
    setAccount(salary.account)
    setDay(String(salary.day))
    // Seed once when the saved salary loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!salary])

  // Nothing changed since the last save: the button says "Saved" and rests.
  const unchanged =
    !!salary &&
    parseBalance(amount) === salary.amount &&
    account === salary.account &&
    Number(day) === salary.day
  const lastDay = Number(day) >= LAST_DAY
  const dayNote = Number(day) >= 1 ? shortMonthNote(Number(day)) : null

  const save = async () => {
    errors.clear()
    const value = parseBalance(amount)
    const d = Number(day)
    if (value === null || value <= 0) return errors.fail('Enter your monthly salary.', 'amount')
    if (account === PICK) return errors.fail('Choose the account it is paid into.', 'account')
    if (!Number.isInteger(d) || d < 1 || d > 31) return errors.fail('Pay day is a day of the month, 1 to 31.', 'day')
    try {
      await settings.updateSalary.mutateAsync({ amount: value, account, day: d })
      show('Salary saved. You’ll be asked on pay day.')
      onSaved?.()
    } catch (e) {
      errors.fail(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const clear = async () => {
    await settings.updateSalary.mutateAsync(null)
    setAmount('')
    setAccount(PICK)
    setDay('')
    show('Salary removed.')
  }

  const Wrap = bare ? BareWrap : SalaryCard
  return (
    <Wrap>
      {!bare && (
      <div className="flex items-center gap-2">
        <Wallet size={16} className="text-accent-dark" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-slate-800">Salary</h3>
      </div>
      )}
      <p className="text-helper text-slate-500">
        {salary
          ? `${format(salary.amount)} into ${salary.account} on ${payDayLabel(salary.day)}. On pay day you're asked if it arrived; Yes logs it with the tag #salary.`
          : 'Set your salary and pay day. On pay day Home asks if it arrived; Yes logs it as income with the tag #salary.'}
      </p>
      <FormError message={errors.general} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Monthly salary" inputMode="decimal" error={errors.on('amount')} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 62000" />
        <div className="flex flex-col gap-1.5">
          <span className="text-helper font-medium text-slate-600">Paid into</span>
          <Dropdown
            options={account === PICK ? [PICK, ...options] : options}
            value={account}
            error={errors.on('account')}
            aria-label="Account the salary is paid into"
            onChange={(e) => setAccount(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <TextField
            label="Pay day"
            inputMode="numeric"
            error={errors.on('day')}
            value={lastDay ? '' : day}
            onChange={(e) => setDay(e.target.value.replace(/\D/g, ''))}
            placeholder={lastDay ? 'Last day' : 'e.g. 1'}
            maxLength={2}
          />
          <button
            type="button"
            aria-pressed={lastDay}
            onClick={() => setDay(lastDay ? '' : String(LAST_DAY))}
            className={clsx(
              'inline-flex min-h-[36px] items-center gap-1.5 self-start rounded-full border px-3 text-helper font-semibold transition-colors',
              lastDay ? 'border-accent bg-accent-light text-accent-on-light' : 'border-app-border text-slate-600'
            )}
          >
            {lastDay && <Check size={13} aria-hidden="true" />}
            Last day of the month
          </button>
        </div>
      </div>
      {dayNote && <p className="-mt-1 text-helper text-slate-500">{dayNote}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={settings.updateSalary.isPending || unchanged}>
          {settings.updateSalary.isPending ? (
            'Saving…'
          ) : unchanged ? (
            <>
              <Check size={15} aria-hidden="true" /> Saved
            </>
          ) : (
            'Save salary'
          )}
        </Button>
        {salary && (
          <Button variant="secondary" onClick={clear} disabled={settings.updateSalary.isPending}>
            Remove
          </Button>
        )}
      </div>
    </Wrap>
  )
}

function SalaryCard({ children }: { children: React.ReactNode }) {
  return <Card className="flex flex-col gap-4 p-5">{children}</Card>
}

function BareWrap({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>
}
