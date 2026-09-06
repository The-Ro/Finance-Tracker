import { UploadCard } from '@/components/documents/UploadCard'
import { DocumentVaultList } from '@/components/documents/DocumentVaultList'

export function DocumentsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-slate-900">Documents</h1>
      <UploadCard />
      <DocumentVaultList />
    </div>
  )
}
