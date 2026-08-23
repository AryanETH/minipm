import { PageHeader } from '@/components/layout/page-header'
import { SourcesClient } from '@/components/sources/sources-client'

export const dynamic = 'force-dynamic'

export default function SourcesPage() {
  return (
    <div>
      <PageHeader
        title="Sources"
        description="Configure where content ideas are discovered"
      />
      <SourcesClient />
    </div>
  )
}
