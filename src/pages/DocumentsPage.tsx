import { PageHeader } from '@/components/ui/PageHeader'
import { UploadCard } from '@/components/documents/UploadCard'
import { DocumentVaultList } from '@/components/documents/DocumentVaultList'

export function DocumentsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Documents" />
      <UploadCard />
      <DocumentVaultList />
    </div>
  )
}
