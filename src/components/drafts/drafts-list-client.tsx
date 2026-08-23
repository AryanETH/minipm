'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { FileText, Share2, Briefcase, Image, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { scoreColor } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface Draft {
  id: string
  xContent?: string
  linkedinContent?: string
  imageHeadline?: string
  imageSubheadline?: string
  status: string
  createdAt: string
  idea: {
    overallScore: number
    category: string
    coreIdea: string
    comment: { source?: { name: string } }
  }
  scheduledPosts: { id: string; platform: string; status: string }[]
}

export function DraftsListClient() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const fetchDrafts = useCallback(async () => {
    setLoading(true)
    const query = filter !== 'all' ? `?status=${filter}` : ''
    const res = await fetch(`/api/drafts${query}`)
    const data = await res.json() as { drafts: Draft[]; total: number }
    setDrafts(data.drafts)
    setTotal(data.total)
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchDrafts() }, [fetchDrafts])

  return (
    <div className="px-8 py-6">
      <div className="flex items-center gap-2 mb-6">
        {['all', 'DRAFT', 'APPROVED'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm transition-colors',
              filter === f ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
        <span className="text-sm text-zinc-600 ml-auto">{total} draft{total !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-zinc-800 rounded-lg">
          <FileText className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">No drafts yet</p>
          <p className="text-sm text-zinc-600 mt-1 mb-4">Create posts from high-scoring ideas in the Content Inbox</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/inbox">Go to Inbox →</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in">
          {drafts.map((draft) => (
            <Link key={draft.id} href={`/drafts/${draft.id}`} className="block group">
              <Card className="hover:border-zinc-700 transition-all group-hover:bg-zinc-900/80">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="default" className="text-[10px]">{draft.idea.category}</Badge>
                      <span className={`text-sm font-semibold tabular-nums ${scoreColor(draft.idea.overallScore)}`}>
                        {draft.idea.overallScore.toFixed(1)}
                      </span>
                      {draft.idea.comment.source && (
                        <span className="text-xs text-zinc-600">{draft.idea.comment.source.name}</span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-300 font-medium truncate mb-1">{draft.idea.coreIdea}</p>
                    <div className="flex items-center gap-3 text-xs text-zinc-600">
                      {draft.xContent && (
                        <span className="flex items-center gap-1"><Share2 className="w-3 h-3 text-sky-400" /> X draft</span>
                      )}
                      {draft.linkedinContent && (
                        <span className="flex items-center gap-1"><Briefcase className="w-3 h-3 text-blue-500" /> LinkedIn draft</span>
                      )}
                      {draft.imageHeadline && (
                        <span className="flex items-center gap-1"><Image className="w-3 h-3 text-purple-400" /> Image</span>
                      )}
                      <span className="ml-auto">{formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {draft.scheduledPosts.length > 0 ? (
                      <Badge variant="emerald">{draft.scheduledPosts.length} queued</Badge>
                    ) : (
                      <Badge variant={draft.status === 'APPROVED' ? 'indigo' : 'default'}>
                        {draft.status.charAt(0) + draft.status.slice(1).toLowerCase()}
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
