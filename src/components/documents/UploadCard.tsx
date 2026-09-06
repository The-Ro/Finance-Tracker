import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useDocuments } from '@/hooks/useDocuments'

export function UploadCard() {
  const { upload } = useDocuments()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    setError(null)
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync(file)
      } catch (e) {
        setError(e instanceof Error ? e.message : `Could not upload ${file.name}.`)
      }
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <Card className="flex flex-col items-center gap-3 border-dashed p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-light text-accent">
        <Upload size={22} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-800">Upload documents</p>
        <p className="mt-1 text-helper text-slate-500">
          Receipts, statements, invoices, images, PDFs, spreadsheets, and CSVs. Up to 20 MB each.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.csv,.xls,.xlsx"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
        {upload.isPending ? 'Uploading…' : 'Choose files'}
      </Button>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
    </Card>
  )
}
