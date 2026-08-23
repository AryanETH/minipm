import { PageHeader } from '@/components/layout/page-header'
import { SettingsClient } from '@/components/settings/settings-client'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Configure your content engine" />
      <SettingsClient />
    </div>
  )
}
