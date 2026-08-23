import { PageHeader } from '@/components/layout/page-header'
import { QueueClient } from '@/components/queue/queue-client'

export const dynamic = 'force-dynamic'

export default function QueuePage() {
  return (
    <div>
      <PageHeader
        title="Content Queue"
        description="Scheduled and pending posts"
      />
      <QueueClient />
    </div>
  )
}
