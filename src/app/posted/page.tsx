import { PageHeader } from '@/components/layout/page-header'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Share2, Briefcase, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type PublishedPostWithRelations = Prisma.PublishedPostGetPayload<{
  include: {
    scheduledPost: {
      include: {
        draft: {
          include: { idea: true }
        }
      }
    }
  }
}>

export default async function PostedPage() {
  const published = await prisma.publishedPost.findMany({
    orderBy: { postedAt: 'desc' },
    take: 50,
    include: {
      scheduledPost: {
        include: {
          draft: {
            include: { idea: true },
          },
        },
      },
    },
  })

  return (
    <div>
      <PageHeader
        title="Posted"
        description={`${published.length} posts published`}
      />
      <div className="px-8 py-6">
        {published.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-800 rounded-lg">
            <CheckCircle2 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">No posts published yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {published.map((p: PublishedPostWithRelations) => (
              <Card key={p.id} className="hover:border-zinc-700 transition-all">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="shrink-0">
                    {p.platform === 'X' ? (
                      <Share2 className="w-4 h-4 text-sky-400" />
                    ) : (
                      <Briefcase className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 line-clamp-2">{p.scheduledPost.content}</p>
                    <p className="text-xs text-zinc-600 mt-1">{p.scheduledPost.draft.idea.coreIdea}</p>
                  </div>
                  <div className="text-xs text-zinc-500 shrink-0">
                    {format(new Date(p.postedAt), 'MMM d, HH:mm')}
                  </div>
                  <Badge variant="emerald" className="shrink-0">Posted</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
