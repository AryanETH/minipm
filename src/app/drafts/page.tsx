import { PageHeader } from '@/components/layout/page-header'
import { DraftsListClient } from '@/components/drafts/drafts-list-client'

export const dynamic = 'force-dynamic'

export default function DraftsPage() {
  return (
    <div>
      <PageHeader
        title="Drafts"
        description="Generated post drafts ready for review and editing"
      />
      <DraftsListClient />
    </div>
  )
}
