'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  PlayCircle,
  Search,
  Video,
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface Source {
  id: string
  type: string
  name: string
  identifier: string
  handle?: string
  profileImage?: string
  enabled: boolean
  priority: number
  commentsLimit: number
  minimumLikes: number
  lastCheckedAt?: string
  createdAt: string
  _count: { videos: number; comments: number }
}

function SourceTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'CHANNEL': return <PlayCircle className="w-4 h-4 text-red-400" />
    case 'VIDEO': return <Video className="w-4 h-4 text-orange-400" />
    case 'KEYWORD': return <Search className="w-4 h-4 text-purple-400" />
    default: return null
  }
}

export function SourcesClient() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [scanning, setScanningId] = useState<string | null>(null)
  const [newSource, setNewSource] = useState({
    type: 'CHANNEL',
    identifier: '',
    commentsLimit: 100,
    minimumLikes: 0,
    priority: 5,
  })
  const [adding, setAdding] = useState(false)

  const fetchSources = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/sources')
    const data = await res.json() as Source[]
    setSources(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSources() }, [fetchSources])

  const handleAdd = async () => {
    if (!newSource.identifier.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSource),
      })
      const data = await res.json() as { error?: string | { fieldErrors?: Record<string, string[]> } }
      if (!res.ok) {
        const errorMsg = typeof data.error === 'string' ? data.error : 'Failed to add source'
        throw new Error(errorMsg)
      }
      toast({ title: 'Source added', variant: 'success' })
      setAddOpen(false)
      setNewSource({ type: 'CHANNEL', identifier: '', commentsLimit: 100, minimumLikes: 0, priority: 5 })
      fetchSources()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (source: Source) => {
    await fetch(`/api/sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !source.enabled }),
    })
    setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, enabled: !s.enabled } : s))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this source? All associated data will also be removed.')) return
    await fetch(`/api/sources/${id}`, { method: 'DELETE' })
    setSources((prev) => prev.filter((s) => s.id !== id))
    toast({ title: 'Source deleted' })
  }

  const handleScan = async (id: string) => {
    setScanningId(id)
    try {
      const res = await fetch(`/api/sources/${id}/scan`, { method: 'POST' })
      const data = await res.json() as {
        error?: string
        commentsCollected?: number
        commentsFiltered?: number
        commentsQueued?: number
        videosCollected?: number
      }
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      toast({
        title: 'Scan complete',
        description: `${data.commentsCollected} comments collected, ${data.commentsQueued} queued for analysis`,
        variant: 'success',
      })
      fetchSources()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Scan failed', variant: 'destructive' })
    } finally {
      setScanningId(null)
    }
  }

  const placeholder = {
    CHANNEL: '@YCombinator or UC... channel ID',
    VIDEO: 'https://youtube.com/watch?v=... or video ID',
    KEYWORD: 'AI agents, startups, product management',
  }[newSource.type] || ''

  return (
    <div className="px-8 py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-zinc-500">{sources.length} source{sources.length !== 1 ? 's' : ''}</div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Source
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-lg" />
          ))}
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-zinc-800 rounded-lg">
          <PlayCircle className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">No sources yet</p>
          <p className="text-sm text-zinc-600 mt-1 mb-4">Add YouTube channels, videos, or keywords to discover content</p>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" />
            Add your first source
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <Card
              key={source.id}
              className={cn(
                'hover:border-zinc-700 transition-all',
                !source.enabled && 'opacity-60'
              )}
            >
              <CardContent className="p-4 flex items-center gap-4">
                {/* Type Icon */}
                <div className="w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                  <SourceTypeIcon type={source.type} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-zinc-200 truncate">{source.name}</p>
                    <Badge variant="default" className="text-[10px] shrink-0">
                      {source.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 truncate">
                    {source.handle || source.identifier}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-600">
                    <span>{source._count.videos} videos</span>
                    <span>{source._count.comments} comments</span>
                    <span>Limit: {source.commentsLimit}/video</span>
                    {source.lastCheckedAt && (
                      <span>Last scan: {formatDistanceToNow(new Date(source.lastCheckedAt), { addSuffix: true })}</span>
                    )}
                  </div>
                </div>

                {/* Priority */}
                <div className="text-xs text-zinc-600 shrink-0">
                  P{source.priority}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={source.enabled}
                    onCheckedChange={() => handleToggle(source)}
                    aria-label="Toggle source"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleScan(source.id)}
                    disabled={scanning === source.id || !source.enabled}
                    title="Scan now"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', scanning === source.id && 'animate-spin')} />
                  </Button>
                  {source.type === 'CHANNEL' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      asChild
                      title="Open channel"
                    >
                      <a href={`https://youtube.com/channel/${source.identifier}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(source.id)}
                    className="text-red-500/60 hover:text-red-400 hover:bg-red-500/10"
                    title="Delete source"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Source Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Source</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Source Type</label>
              <Select
                value={newSource.type}
                onValueChange={(v) => setNewSource((p) => ({ ...p, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHANNEL">YouTube Channel</SelectItem>
                  <SelectItem value="VIDEO">Individual Video</SelectItem>
                  <SelectItem value="KEYWORD">Keyword Search</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                {newSource.type === 'CHANNEL' ? 'Channel URL / ID / Handle' :
                 newSource.type === 'VIDEO' ? 'Video URL or ID' : 'Keyword'}
              </label>
              <Input
                placeholder={placeholder}
                value={newSource.identifier}
                onChange={(e) => setNewSource((p) => ({ ...p, identifier: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              />
              {!process.env.NEXT_PUBLIC_HAS_YT_KEY && newSource.type !== 'KEYWORD' && (
                <div className="flex items-center gap-1.5 mt-2 text-yellow-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Make sure YouTube API Key is configured in Settings
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Comments/video</label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={newSource.commentsLimit}
                  onChange={(e) => setNewSource((p) => ({ ...p, commentsLimit: parseInt(e.target.value) || 100 }))}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Min likes</label>
                <Input
                  type="number"
                  min={0}
                  value={newSource.minimumLikes}
                  onChange={(e) => setNewSource((p) => ({ ...p, minimumLikes: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Priority (1-10)</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={newSource.priority}
                  onChange={(e) => setNewSource((p) => ({ ...p, priority: parseInt(e.target.value) || 5 }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={adding || !newSource.identifier.trim()}>
                {adding ? 'Adding...' : 'Add Source'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
