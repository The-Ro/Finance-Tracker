import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { InlineMessage } from '@/components/ui/InlineMessage'
import {
  parseCsvFile,
  detectColumnMapping,
  normalizeCsvRows,
  type CsvColumnMapping,
  type ParsedCsv,
} from '@/lib/csvImport'
import { useAccounts, useCategories } from '@/hooks/useLookupLists'
import { useBulkImportTransactions, type BulkImportResult } from '@/hooks/useTransactions'
import { useRules } from '@/hooks/useRules'

interface CsvImportModalProps {
  open: boolean
  onClose: () => void
}

type Step = 'pick' | 'map' | 'result'

const FIELD_LABELS: { key: keyof CsvColumnMapping; label: string; required?: boolean }[] = [
  { key: 'date', label: 'Date', required: true },
  { key: 'merchant', label: 'Merchant / description', required: true },
  { key: 'amount', label: 'Amount (signed, or with a Type column)' },
  { key: 'debit', label: 'Debit / withdrawal column' },
  { key: 'credit', label: 'Credit / deposit column' },
  { key: 'type', label: 'Type: expense/income, Dr/Cr (optional)' },
  { key: 'category', label: 'Category (optional)' },
  { key: 'account', label: 'Account (optional)' },
]

export function CsvImportModal({ open, onClose }: CsvImportModalProps) {
  const [step, setStep] = useState<Step>('pick')
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [mapping, setMapping] = useState<CsvColumnMapping | null>(null)
  const [fallbackAccount, setFallbackAccount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [skipDetail, setSkipDetail] = useState({ invalidDates: 0, transfers: 0 })

  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: rules = [] } = useRules()
  const bulkImport = useBulkImportTransactions()

  const resetAll = () => {
    setStep('pick')
    setParsed(null)
    setMapping(null)
    setError(null)
    setResult(null)
    setSkipDetail({ invalidDates: 0, transfers: 0 })
  }

  const handleClose = () => {
    if (bulkImport.isPending) return
    resetAll()
    onClose()
  }

  const handleFile = async (file: File) => {
    setError(null)
    try {
      const csv = await parseCsvFile(file)
      if (csv.rows.length === 0) {
        setError('That file has no rows to import.')
        return
      }
      setParsed(csv)
      setMapping(detectColumnMapping(csv.headers))
      setFallbackAccount(accounts[0] ?? '')
      setStep('map')
    } catch {
      setError('Could not read that CSV file. Make sure it is a plain CSV export from your bank or card.')
    }
  }

  const handleImport = async () => {
    if (!parsed || !mapping) return
    if (!mapping.date || !mapping.merchant) {
      setError('Map at least a Date and a Merchant/description column before importing.')
      return
    }
    if (!fallbackAccount) {
      setError('Choose a fallback account before importing.')
      return
    }
    if (!mapping.amount && !mapping.debit && !mapping.credit) {
      setError('Map either a single Amount column, or Debit/Credit columns.')
      return
    }

    const { ok, skipped, invalidDates, transfers } = normalizeCsvRows(
      parsed.rows,
      mapping,
      fallbackAccount,
      categories,
      accounts
    )
    setSkipDetail({ invalidDates, transfers })
    try {
      const res = await bulkImport.mutateAsync({
        rows: ok,
        skippedDuringParsing: skipped,
        rules: rules.map((r) => ({ whenText: r.when_text, thenText: r.then_text, enabled: r.enabled })),
      })
      setResult(res)
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import a statement" maxWidthClassName="max-w-xl">
      {step === 'pick' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Choose a CSV export from your bank or card. You'll get a chance to check the column mapping
            before anything is imported.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
            className="text-sm"
          />
          {error && <InlineMessage tone="error">{error}</InlineMessage>}
        </div>
      )}

      {step === 'map' && parsed && mapping && (
        <div className="flex flex-col gap-4">
          <p className="text-helper text-slate-500">
            Detected {parsed.rows.length} row{parsed.rows.length === 1 ? '' : 's'}. Confirm which columns
            mean what.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELD_LABELS.map(({ key, label, required }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-helper font-medium text-slate-600">
                  {label} {required && <span className="text-red-500">*</span>}
                </label>
                <Dropdown
                  options={['(none)', ...parsed.headers]}
                  value={mapping[key] ?? '(none)'}
                  onChange={(e) =>
                    setMapping((m) => (m ? { ...m, [key]: e.target.value === '(none)' ? null : e.target.value } : m))
                  }
                />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <label className="text-helper font-medium text-slate-600">Fallback account</label>
              <Dropdown options={accounts} value={fallbackAccount} onChange={(e) => setFallbackAccount(e.target.value)} />
            </div>
          </div>
          {error && <InlineMessage tone="error">{error}</InlineMessage>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={resetAll}>
              Start over
            </Button>
            <Button onClick={handleImport} disabled={bulkImport.isPending}>
              {bulkImport.isPending ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-positive-light p-3">
              <div className="text-lg font-semibold text-positive">{result.inserted}</div>
              <div className="text-helper text-slate-500">Inserted</div>
            </div>
            <div className="rounded-lg bg-caution-light p-3">
              <div className="text-lg font-semibold text-caution">{result.duplicates}</div>
              <div className="text-helper text-slate-500">Duplicates</div>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <div className="text-lg font-semibold text-slate-600">{result.skipped}</div>
              <div className="text-helper text-slate-500">Skipped</div>
            </div>
          </div>
          {(skipDetail.invalidDates > 0 || skipDetail.transfers > 0) && (
            <ul className="flex flex-col gap-1 text-helper text-slate-500">
              {skipDetail.invalidDates > 0 && (
                <li>
                  {skipDetail.invalidDates} row{skipDetail.invalidDates === 1 ? '' : 's'} skipped because the date
                  isn't a real calendar date.
                </li>
              )}
              {skipDetail.transfers > 0 && (
                <li>
                  {skipDetail.transfers} transfer{skipDetail.transfers === 1 ? '' : 's'} skipped. Import only brings in
                  expenses and income, so add transfers from New entry.
                </li>
              )}
            </ul>
          )}
          <div className="flex justify-end">
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
