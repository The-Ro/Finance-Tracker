import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useUserSettings } from '@/hooks/useUserSettings'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'

export function CurrencySelector() {
  const { data, updateCurrency } = useUserSettings()
  const [value, setValue] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const current = value ?? data?.currency ?? 'USD'
  const options = SUPPORTED_CURRENCIES.map((c) => `${c.code} - ${c.label} (${c.symbol})`)
  const currentLabel = options.find((o) => o.startsWith(current + ' '))

  const handleChange = async (label: string) => {
    const code = label.split(' ')[0]
    setValue(code)
    setSaved(false)
    await updateCurrency.mutateAsync(code)
    setSaved(true)
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Currency</h3>
        <p className="mt-1 text-helper text-slate-500">Used for every amount shown across Ledgerly.</p>
      </div>
      <Dropdown options={options} value={currentLabel ?? options[0]} onChange={(e) => handleChange(e.target.value)} />
      {saved && <InlineMessage tone="success">Currency saved.</InlineMessage>}
      {updateCurrency.isPending && <span className="text-helper text-slate-400">Saving…</span>}
    </Card>
  )
}
