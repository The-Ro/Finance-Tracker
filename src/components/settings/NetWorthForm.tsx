import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'

const AUTOSAVE_DELAY_MS = 800

export function NetWorthForm() {
  const settings = useUserSettings()
  const { format } = useFormatCurrency()
  const [assets, setAssets] = useState('')
  const [liabilities, setLiabilities] = useState('')
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!settings.data) return
    setAssets(String(settings.data.assetsTotal))
    setLiabilities(String(settings.data.liabilitiesTotal))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.data?.assetsTotal, settings.data?.liabilitiesTotal])

  const assetsNum = Number(assets || 0)
  const liabilitiesNum = Number(liabilities || 0)

  // Unlike Personal details' discrete pickers, these are free-text number
  // inputs -- saving on every keystroke would fire a request per digit
  // typed. Debounce instead: each change resets the timer, and only the
  // value still current after the user pauses actually gets saved.
  useEffect(() => {
    if (!settings.data) return
    if (assetsNum === settings.data.assetsTotal && liabilitiesNum === settings.data.liabilitiesTotal) return
    if (!Number.isFinite(assetsNum) || assetsNum < 0 || !Number.isFinite(liabilitiesNum) || liabilitiesNum < 0) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setError(null)
      try {
        await settings.updateNetWorth.mutateAsync({ assetsTotal: assetsNum, liabilitiesTotal: liabilitiesNum })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save.')
      }
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsNum, liabilitiesNum])

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Net worth</h3>
        <p className="mt-1 text-helper text-slate-500">
          Net worth is your total assets minus total liabilities - it is not calculated from your monthly
          income minus expenses. Saved automatically.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Total assets"
          type="number"
          step="0.01"
          min="0"
          value={assets}
          onChange={(e) => setAssets(e.target.value)}
        />
        <TextField
          label="Total liabilities"
          type="number"
          step="0.01"
          min="0"
          value={liabilities}
          onChange={(e) => setLiabilities(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
        <span className="text-helper text-slate-500">
          {settings.updateNetWorth.isPending ? 'Saving…' : 'Live preview'}
        </span>
        <span className="text-sm font-semibold text-slate-900">{format(assetsNum - liabilitiesNum)}</span>
      </div>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
    </Card>
  )
}
