'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  PenLine,
  ExternalLink,
  Cpu,
  ChevronRight,
  MessageSquare,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toaster'
import { scoreColor, scoreBadgeClass, formatNumber } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface Idea {
  id: string
  insightScore: number
  noveltyScore: number
  relatabilityScore: number
  controversyScore: number
  viralScore: number
  originalityScore: number
  overallScore: number
  category: string
  coreIdea: string
  reason: string
  shouldUse: boolean
  status: string
  createdAt: string
  comment: {
    id: string
    text: string
    author: string
    likeCount: number
    videoTitle: string
    url?: string
    source?: { name: string; identifier: string }
  }
  drafts: { id: string }[]
}

interface ProgressState {
  active: boolean
  current: number
  total: number
  currentText: string
  processed: number
  qualified: number
  errors: string[]
  model: string
  done: boolean
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className="text-zinc-400 w-6 text-right tabular-nums">{value.toFixed(0)}</span>
    </div>
  )
}

function AnalysisProgress({ progress, onClose }: {
  progress: ProgressState
  onClose: () => void
}) {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <Card className="border-indigo-500/30 bg-indigo-950/20 mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {progress.done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            )}
            <span className="text-sm font-medium text-zinc-200">
              {progress.done ? 'Analysis complete' : 'Analyzing comments...'}
            </span>
            {progress.model && (
              <Badge variant="indigo" className="text-[10px]">{progress.model}</Badge>
            )}
          </div>
          {progress.done && (
            <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-500 h-6 px-2">
              Dismiss
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              progress.done ? 'bg-emerald-500' : 'bg-indigo-500'
            )}
            style={{ width: `${progress.done ? 100 : pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
          <span>{progress.current} / {progress.total} comments</span>
          <span className="tabular-nums">{pct}%</span>
        </div>

        {/* Live stats */}
        <div className="flex items-center gap-4 text-xs">
          <span className="text-zinc-400">
            Processed: <strong className="text-zinc-200">{progress.processed}</strong>
          </span>
          <span className="text-zinc-400">
            Ideas found: <strong className="text-emerald-400">{progress.qualified}</strong>
          </span>
          {progress.errors.length > 0 && (
            <span className="text-red-400">
              Errors: {progress.errors.length}
            </span>
          )}
        </div>

        {/* Current item */}
        {!progress.done && progress.currentText && (
          <p className="text-[11px] text-zinc-600 mt-2 truncate">
            → &ldquo;{progress.currentText}&rdquo;
          </p>
        )}

        {/* Errors */}
        {progress.done && progress.errors.length > 0 && (
          <div className="mt-2 p-2 bg-red-950/30 rounded border border-red-500/20">
            <p className="text-xs text-red-400 font-medium mb-1">Errors ({progress.errors.length}):</p>
            {progress.errors.slice(0, 3).map((e, i) => (
              <p key={i} className="text-[11px] text-red-400/70 truncate">{e}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function InboxClient() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [creatingDraft, setCreatingDraft] = useState<string | null>(null)
  const [filter, setFilter] = useState<'PENDING' | 'REJECTED' | 'all'>('PENDING')
  const [progress, setProgress] = useState<ProgressState | null>(null)

  const fetchIdeas = useCallback(async (p = 1) => {
    setLoading(true)
    const statusParam = filter === 'all' ? 'all' : filter
    const res = await fetch(`/api/ideas?status=${statusParam}&page=${p}&limit=20&minScore=0`)
    const data = await res.json() as { ideas: Idea[]; total: number }
    setIdeas(data.ideas)
    setTotal(data.total)
    setPage(p)
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchIdeas(1) }, [fetchIdeas])

  const processComments = async () => {
    if (progress?.active && !progress?.done) return

    setProgress({
      active: true, current: 0, total: 0,
      currentText: '', processed: 0, qualified: 0,
      errors: [], model: '', done: false,
    })

    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 20, stream: true }),
      })

      if (!res.ok) {
        let errMsg = 'Analysis failed'
        let debugInfo: { totalComments?: number; alreadyProcessed?: number; filtered?: number; available?: number } = {}
        try {
          const data = await res.json() as { error?: string; debug?: typeof debugInfo }
          errMsg = data.error ?? errMsg
          debugInfo = data.debug ?? {}
        } catch { /* body may not be JSON */ }

        if (debugInfo.totalComments === 0) {
          toast({ title: 'No comments yet', description: 'Scan a source first.', variant: 'destructive' })
        } else if ((debugInfo.alreadyProcessed ?? 0) > 0 && (debugInfo.available ?? 0) === 0) {
          toast({ title: 'All comments already analyzed', description: 'Ideas appear below, or scan for new comments.', variant: 'success' })
          fetchIdeas(1)
        } else {
          toast({ title: errMsg, variant: 'destructive' })
        }
        setProgress(null)
        return
      }

      // The route returns SSE when stream=true and there are comments to process,
      // but falls back to plain JSON when there are none — handle both
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        // Plain JSON response (no-comments case)
        try {
          const data = await res.json() as {
            processed?: number; qualified?: number; message?: string;
            debug?: { totalComments: number; alreadyProcessed: number; filtered: number; available: number }
          }
          const d = data.debug
          if (d && d.alreadyProcessed > 0 && d.available === 0) {
            toast({ title: 'All comments already analyzed', description: 'Click Re-filter if you want to re-process.', variant: 'success' })
            fetchIdeas(1)
          } else {
            toast({ title: data.message || 'Nothing to process', description: d ? `Total: ${d.totalComments}, Filtered: ${d.filtered}` : undefined })
          }
        } catch {
          toast({ title: 'No comments to analyze' })
        }
        setProgress(null)
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string
              total?: number
              current?: number
              processed?: number
              qualified?: number
              text?: string
              model?: string
              score?: number
              category?: string
              message?: string
              errors?: string[]
            }
            if (event.type === 'start') {
              setProgress((p) => p ? { ...p, total: event.total ?? 0, model: event.model ?? '' } : p)
            } else if (event.type === 'progress') {
              setProgress((p) => p ? {
                ...p,
                current: event.current ?? p.current,
                total: event.total ?? p.total,
                currentText: event.text ?? '',
              } : p)
            } else if (event.type === 'item') {
              setProgress((p) => p ? {
                ...p,
                current: (event.current ?? p.current) + 1,
                processed: event.processed ?? p.processed,
                qualified: event.qualified ?? p.qualified,
              } : p)
            } else if (event.type === 'error') {
              setProgress((p) => p ? {
                ...p,
                errors: [...p.errors, event.message ?? 'Unknown error'],
              } : p)
            } else if (event.type === 'promoted') {
              // Auto-promoted fallback ideas
              toast({
                title: `Promoted top ${(event as { count?: number }).count ?? 0} ideas`,
                description: (event as { message?: string }).message,
                variant: 'default',
              })
            } else if (event.type === 'drafted') {
              // Auto-generated drafts from promoted ideas
              toast({
                title: `Auto-generated ${(event as { count?: number }).count ?? 0} draft${((event as { count?: number }).count ?? 0) > 1 ? 's' : ''}`,
                description: (event as { message?: string }).message,
                variant: 'success',
              })
            } else if (event.type === 'done') {
              setProgress((p) => p ? {
                ...p,
                processed: event.processed ?? p.processed,
                qualified: event.qualified ?? p.qualified,
                errors: event.errors ?? p.errors,
                done: true,
                active: false,
              } : p)
              fetchIdeas(1)
              // Contextual message for empty-stream case
              const debug = (event as { debug?: { totalComments: number; alreadyProcessed: number; filtered: number; available: number } }).debug
              if ((event.processed ?? 0) === 0 && debug) {
                if (debug.totalComments === 0) {
                  toast({ title: 'No comments yet', description: 'Add a source and click Scan first.', variant: 'destructive' })
                } else if (debug.alreadyProcessed > 0 && debug.available === 0) {
                  toast({ title: 'All comments already analyzed', description: 'Ideas shown below. Scan for more.' })
                } else if (debug.filtered > 0) {
                  toast({ title: `${debug.filtered} comments filtered out`, description: 'Click Re-filter to reprocess with updated rules.' })
                }
              }
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Analysis failed', variant: 'destructive' })
      setProgress(null)
    }
  }

  const resetFilter = async () => {
    try {
      const res = await fetch('/api/comments/reset', { method: 'POST' })
      const data = await res.json() as { resetCount?: number; message?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      toast({ title: 'Filter reset', description: data.message, variant: 'success' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Reset failed', variant: 'destructive' })
    }
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/ideas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setIdeas((prev) => prev.map((i) => i.id === id ? { ...i, status } : i))
    if (status === 'REJECTED') toast({ title: 'Idea rejected' })
    else if (status === 'SAVED') toast({ title: 'Idea saved', variant: 'success' })
  }

  const createDraft = async (ideaId: string) => {
    setCreatingDraft(ideaId)
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId }),
      })
      const data = await res.json() as { id?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to create draft')
      toast({ title: 'Draft created!', variant: 'success' })
      window.location.href = `/drafts/${data.id}`
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
    } finally {
      setCreatingDraft(null)
    }
  }

  const isProcessing = progress?.active && !progress?.done

  return (
    <div className="px-8 py-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          {(['PENDING', 'REJECTED', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors',
                filter === f
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {f === 'all' ? 'All' : f === 'PENDING' ? 'Inbox' : 'Rejected'}
              {filter === f && (
                <span className="ml-1.5 text-xs text-zinc-500">{total}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilter}
            disabled={isProcessing}
            title="Re-run filter rules on collected comments"
            className="text-zinc-500"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-filter
          </Button>
          <Button
            onClick={processComments}
            disabled={isProcessing}
            size="sm"
          >
            {isProcessing ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
            ) : (
              <><Zap className="w-3.5 h-3.5" /> Analyze Comments</>
            )}
          </Button>
        </div>
      </div>

      {/* Progress panel */}
      {progress && (
        <AnalysisProgress
          progress={progress}
          onClose={() => setProgress(null)}
        />
      )}

      {/* Ideas list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : ideas.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-zinc-800 rounded-lg">
          <MessageSquare className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">
            {filter === 'PENDING' ? 'No ideas waiting for review' : 'Nothing here'}
          </p>
          <p className="text-sm text-zinc-600 mt-1 mb-4">
            {filter === 'PENDING'
              ? 'Click "Analyze Comments" to process collected comments'
              : 'Analyzed ideas appear here'}
          </p>
          <Button onClick={processComments} disabled={isProcessing} size="sm">
            <Zap className="w-3.5 h-3.5" />
            Analyze Comments
          </Button>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in">
          {ideas.map((idea) => (
            <Card
              key={idea.id}
              className={cn(
                'hover:border-zinc-700 transition-all',
                expanded === idea.id && 'border-zinc-700'
              )}
            >
              <CardContent className="p-4">
                {/* Header row */}
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'text-lg font-bold tabular-nums shrink-0 w-12 h-12 rounded-lg flex items-center justify-center border',
                      scoreBadgeClass(idea.overallScore)
                    )}
                  >
                    {idea.overallScore.toFixed(1)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="default" className="text-[10px]">{idea.category}</Badge>
                      {idea.comment.source && (
                        <span className="text-xs text-zinc-600">{idea.comment.source.name}</span>
                      )}
                      <span className="text-xs text-zinc-600 ml-auto">
                        {formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-zinc-200 mb-1.5">{idea.coreIdea}</p>
                    <p className="text-xs text-zinc-500 line-clamp-2">{idea.reason}</p>
                  </div>
                </div>

                {/* Expanded */}
                {expanded === idea.id && (
                  <div className="mt-4 pt-4 border-t border-zinc-800/80 space-y-4 animate-fade-in">
                    <div className="bg-zinc-800/40 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-500 font-medium">Original Comment</span>
                        <div className="flex items-center gap-2 text-xs text-zinc-600">
                          <ThumbsUp className="w-3 h-3" />
                          {formatNumber(idea.comment.likeCount)}
                          {idea.comment.url && (
                            <a href={idea.comment.url} target="_blank" rel="noopener noreferrer"
                              className="hover:text-indigo-400">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-zinc-300">{idea.comment.text}</p>
                      <p className="text-xs text-zinc-600 mt-1.5">
                        by {idea.comment.author} · {idea.comment.videoTitle}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <ScoreBar label="Insight" value={idea.insightScore} />
                      <ScoreBar label="Novelty" value={idea.noveltyScore} />
                      <ScoreBar label="Viral" value={idea.viralScore} />
                      <ScoreBar label="Relatability" value={idea.relatabilityScore} />
                      <ScoreBar label="Originality" value={idea.originalityScore} />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/60">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-500"
                    onClick={() => setExpanded(expanded === idea.id ? null : idea.id)}
                  >
                    {expanded === idea.id ? 'Less' : 'Details'}
                    <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', expanded === idea.id && 'rotate-90')} />
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500/60 hover:text-red-400 hover:bg-red-500/10"
                    onClick={() => updateStatus(idea.id, 'REJECTED')}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    Reject
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateStatus(idea.id, 'SAVED')}
                    disabled={idea.status === 'SAVED'}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    Save
                  </Button>
                  {idea.drafts.length > 0 ? (
                    <Button variant="success" size="sm" asChild>
                      <Link href={`/drafts/${idea.drafts[0].id}`}>
                        <PenLine className="w-3.5 h-3.5" />
                        View Draft
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => createDraft(idea.id)}
                      disabled={creatingDraft === idea.id}
                    >
                      {creatingDraft === idea.id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                      ) : (
                        <><PenLine className="w-3.5 h-3.5" /> Create Post</>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {total > 20 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchIdeas(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-zinc-500 flex items-center px-3">
                {page} / {Math.ceil(total / 20)}
              </span>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => fetchIdeas(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
