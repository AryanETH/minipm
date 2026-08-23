'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Share2,
  Briefcase,
  Clock,
  Check,
  X,
  Copy,
  CheckCircle2,
  ExternalLink,
  CalendarClock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { statusColor } from '@/lib/utils'
import { format, isToday, isTomorrow, addDays } from 'date-fns'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface QueuePost {
  id: string
  platform: string
  content: string
  scheduledAt?: string
  status: string
  createdAt: string
  draft: {
    id: string
    idea: {
      category: string
      coreIdea: string
    }
  }
}

function groupByDay(posts: QueuePost[]) {
  const groups: Record<string, QueuePost[]> = {}
  const unscheduled: QueuePost[] = []
  for (const post of posts) {
    if (!post.scheduledAt) {
      unscheduled.push(post)
      continue
    }
    const d = new Date(post.scheduledAt)
    const key = format(d, 'yyyy-MM-dd')
    groups[key] = groups[key] || []
    groups[key].push(post)
  }
  return { groups, unscheduled }
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEEE, MMM d')
}

export function QueueClient() {
  const [posts, setPosts] = useState<QueuePost[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [markPostId, setMarkPostId] = useState<string | null>(null)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [newTime, setNewTime] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    const statusFilter = filter === 'active' ? '&status=SCHEDULED' : filter === 'draft' ? '&status=DRAFT' : ''
    const res = await fetch(`/api/queue?limit=100${statusFilter}`)
    const data = await res.json() as { posts: QueuePost[] }
    setPosts(data.posts)
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const copyContent = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const markAsPosted = async (id: string) => {
    const res = await fetch(`/api/queue/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'POSTED' }),
    })
    if (res.ok) {
      toast({ title: 'Marked as posted', variant: 'success' })
      setPosts((prev) => prev.filter((p) => p.id !== id))
    }
    setMarkPostId(null)
  }

  const rejectPost = async (id: string) => {
    await fetch(`/api/queue/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED' }),
    })
    setPosts((prev) => prev.filter((p) => p.id !== id))
    toast({ title: 'Post rejected' })
  }

  const reschedule = async (id: string) => {
    if (!newTime) return
    await fetch(`/api/queue/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt: new Date(newTime).toISOString(), status: 'SCHEDULED' }),
    })
    setPosts((prev) =>
      prev.map((p) => p.id === id ? { ...p, scheduledAt: new Date(newTime).toISOString(), status: 'SCHEDULED' } : p)
    )
    toast({ title: 'Rescheduled', variant: 'success' })
    setRescheduleId(null)
  }

  const { groups, unscheduled } = groupByDay(posts)
  const sortedDays = Object.keys(groups).sort()

  return (
    <div className="px-8 py-6">
      <div className="flex items-center gap-2 mb-6">
        {[
          { key: 'active', label: 'Scheduled' },
          { key: 'draft', label: 'Drafts' },
          { key: 'all', label: 'All' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm transition-colors',
              filter === key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-zinc-800 rounded-lg">
          <CalendarClock className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">Queue is empty</p>
          <p className="text-sm text-zinc-600 mt-1 mb-4">Create drafts and add them to the queue</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/drafts">Go to Drafts →</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in">
          {/* Unscheduled / manual */}
          {unscheduled.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Manual / Draft</h3>
              <div className="space-y-2">
                {unscheduled.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    copied={copied}
                    onCopy={copyContent}
                    onMarkPosted={setMarkPostId}
                    onReject={rejectPost}
                    onReschedule={(id) => { setRescheduleId(id); setNewTime('') }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Scheduled by day */}
          {sortedDays.map((day) => (
            <div key={day}>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                {dayLabel(day)}
              </h3>
              <div className="space-y-2">
                {groups[day].sort((a, b) =>
                  new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()
                ).map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    copied={copied}
                    onCopy={copyContent}
                    onMarkPosted={setMarkPostId}
                    onReject={rejectPost}
                    onReschedule={(id) => { setRescheduleId(id); setNewTime('') }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mark as posted dialog */}
      <Dialog open={!!markPostId} onOpenChange={() => setMarkPostId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Posted</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Copy the content first, then manually post it. Once done, click Confirm.
          </p>
          <div className="bg-zinc-800/40 rounded-md p-3 text-sm text-zinc-300">
            {posts.find((p) => p.id === markPostId)?.content}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMarkPostId(null)}>Cancel</Button>
            <Button variant="success" onClick={() => markPostId && markAsPosted(markPostId)}>
              <CheckCircle2 className="w-4 h-4" />
              Confirm Posted
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={!!rescheduleId} onOpenChange={() => setRescheduleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Post</DialogTitle>
          </DialogHeader>
          <Input
            type="datetime-local"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRescheduleId(null)}>Cancel</Button>
            <Button onClick={() => rescheduleId && reschedule(rescheduleId)} disabled={!newTime}>
              Reschedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PostCard({
  post,
  copied,
  onCopy,
  onMarkPosted,
  onReject,
  onReschedule,
}: {
  post: QueuePost
  copied: string | null
  onCopy: (id: string, content: string) => void
  onMarkPosted: (id: string) => void
  onReject: (id: string) => void
  onReschedule: (id: string) => void
}) {
  return (
    <Card className="hover:border-zinc-700 transition-all">
      <CardContent className="p-4 flex items-center gap-4">
        {/* Time */}
        <div className="text-xs text-zinc-500 font-mono w-14 shrink-0">
          {post.scheduledAt ? format(new Date(post.scheduledAt), 'HH:mm') : 'Manual'}
        </div>

        {/* Platform */}
        <div className="shrink-0">
          {post.platform === 'X' ? (
            <Share2 className="w-4 h-4 text-sky-400" />
          ) : (
            <Briefcase className="w-4 h-4 text-blue-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-300 line-clamp-2">{post.content}</p>
          <p className="text-xs text-zinc-600 mt-1 truncate">{post.draft.idea.coreIdea}</p>
        </div>

        {/* Status */}
        <Badge className={cn('shrink-0', statusColor(post.status))}>
          {post.status.charAt(0) + post.status.slice(1).toLowerCase()}
        </Badge>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Copy content"
            onClick={() => onCopy(post.id, post.content)}
          >
            {copied === post.id ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Reschedule"
            onClick={() => onReschedule(post.id)}
          >
            <Clock className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/10"
            title="Mark as posted"
            onClick={() => onMarkPosted(post.id)}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-red-500/60 hover:text-red-400 hover:bg-red-500/10"
            title="Reject"
            onClick={() => onReject(post.id)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Edit draft"
            asChild
          >
            <Link href={`/drafts/${post.draft.id}`}>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
