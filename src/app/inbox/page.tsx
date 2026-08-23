import { PageHeader } from '@/components/layout/page-header'
import { InboxClient } from '@/components/inbox/inbox-client'

export const dynamic = 'force-dynamic'

export default function InboxPage() {
  return (
    <div>
      <PageHeader
        title="Content Inbox"
        description="High-quality ideas discovered from your sources"
      />
      <InboxClient />
    </div>
  )
}
