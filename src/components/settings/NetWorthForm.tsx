import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'

export function NetWorthForm() {
  const settings = useUserSettings()
  const { format } = useFormatCurrency()
  const [assets, setAssets] = useState('')
  const [liabilities, setLiabilities] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const assetsNum = Number(assets || settings.data?.assetsTotal || 0)
  const liabilitiesNum = Number(liabilities || settings.data?.liabilitiesTotal || 0)

  const handleSave = async () => {
    setError(null)
    setSaved(false)
    if (!Number.isFinite(assetsNum) || assetsNum < 0) return setError('Enter a valid assets total.')
    if (!Number.isFinite(liabilitiesNum) || liabilitiesNum < 0) return setError('Enter a valid liabilities total.')
    try {
      await settings.updateNetWorth.mutateAsync({ assetsTotal: assetsNum, liabilitiesTotal: liabilitiesNum })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Net worth</h3>
        <p className="mt-1 text-helper text-slate-500">
          Net worth is your total assets minus total liabilities - it is not calculated from your monthly
          income minus expenses.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Total assets"
          type="number"
          step="0.01"
          placeholder={String(settings.data?.assetsTotal ?? 0)}
          value={assets}
          onChange={(e) => setAssets(e.target.value)}
        />
        <TextField
          label="Total liabilities"
          type="number"
          step="0.01"
          placeholder={String(settings.data?.liabilitiesTotal ?? 0)}
          value={liabilities}
          onChange={(e) => setLiabilities(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
        <span className="text-helper text-slate-500">Live preview</span>
        <span className="text-sm font-semibold text-slate-900">{format(assetsNum - liabilitiesNum)}</span>
      </div>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      {saved && <InlineMessage tone="success">Net worth saved.</InlineMessage>}
      <div>
        <Button onClick={handleSave} disabled={settings.updateNetWorth.isPending}>
          {settings.updateNetWorth.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Card>
  )
}
