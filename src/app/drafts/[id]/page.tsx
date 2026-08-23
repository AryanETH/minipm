import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { DraftEditor } from '@/components/drafts/draft-editor'

export const dynamic = 'force-dynamic'

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const draft = await prisma.draft.findUnique({
    where: { id },
    include: {
      idea: {
        include: { comment: { include: { source: true } } },
      },
      scheduledPosts: true,
      generatedImages: { include: { template: true } },
    },
  })

  if (!draft) notFound()

  return (
    <div>
      <PageHeader
        title="Draft Editor"
        description={draft.idea.coreIdea}
      />
      <DraftEditor draft={JSON.parse(JSON.stringify(draft))} />
    </div>
  )
}
