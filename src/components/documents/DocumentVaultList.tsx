import { FileText, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useDocuments } from '@/hooks/useDocuments'
import { formatDate } from '@/lib/format'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentVaultList() {
  const { data: documents = [], remove } = useDocuments()

  if (documents.length === 0) {
    return (
      <EmptyState icon={FileText} title="No documents yet" description="Upload a file or add one to your Drive inbox." />
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      <ul>
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-3 border-b border-app-border px-4 py-3 last:border-b-0">
            <div className="flex min-w-0 items-center gap-3">
              <FileText size={18} className="shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{doc.filename}</p>
                <p className="truncate text-helper text-slate-500">
                  {doc.mime_type} · {formatSize(doc.size)} · {doc.source} · {formatDate(doc.created_at.slice(0, 10))}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">
                {doc.status}
              </span>
              <button
                aria-label="Delete document"
                onClick={() => remove.mutate(doc)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
