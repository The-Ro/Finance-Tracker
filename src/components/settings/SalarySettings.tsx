import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useToast } from '@/context/ToastContext'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { useAccounts } from '@/hooks/useLookupLists'
import { useAccountKinds } from '@/hooks/useCards'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { parseBalance } from '@/lib/onboardingAccounts'

const PICK = 'Choose an account'

/**
 * Settings -> Salary: amount, the account it's paid into and the pay day.
 * On pay day Home asks whether it arrived (SalaryPrompt).
 */
export function SalarySettings() {
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!salary) return
    setAmount(String(salary.amount))
    setAccount(salary.account)
    setDay(String(salary.day))
    // Seed once when the saved salary loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!salary])

  const save = async () => {
    setError(null)
    const value = parseBalance(amount)
    const d = Number(day)
    if (value === null || value <= 0) return setError('Enter your monthly salary.')
    if (account === PICK) return setError('Choose the account it is paid into.')
    if (!Number.isInteger(d) || d < 1 || d > 31) return setError('Pay day is a day of the month, 1 to 31.')
    try {
      await settings.updateSalary.mutateAsync({ amount: value, account, day: d })
      show('Salary saved. You’ll be asked on pay day.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const clear = async () => {
    await settings.updateSalary.mutateAsync(null)
    setAmount('')
    setAccount(PICK)
    setDay('')
    show('Salary removed.')
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <Wallet size={16} className="text-accent-dark" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-slate-800">Salary</h3>
      </div>
      <p className="text-helper text-slate-500">
        {salary
          ? `${format(salary.amount)} into ${salary.account} on day ${salary.day}. On pay day Home asks if it arrived; Yes logs it with the tag #salary.`
          : 'Set your salary and pay day. On pay day Home asks if it arrived; Yes logs it as income with the tag #salary.'}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Monthly salary" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 62000" />
        <div className="flex flex-col gap-1.5">
          <span className="text-helper font-medium text-slate-600">Paid into</span>
          <Dropdown
            options={account === PICK ? [PICK, ...options] : options}
            value={account}
            aria-label="Account the salary is paid into"
            onChange={(e) => setAccount(e.target.value)}
          />
        </div>
        <TextField label="Pay day" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 1" maxLength={2} />
      </div>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={settings.updateSalary.isPending}>
          {settings.updateSalary.isPending ? 'Saving…' : 'Save salary'}
        </Button>
        {salary && (
          <Button variant="secondary" onClick={clear} disabled={settings.updateSalary.isPending}>
            Remove
          </Button>
        )}
      </div>
    </Card>
  )
}
