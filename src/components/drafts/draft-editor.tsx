'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Share2,
  Briefcase,
  Image,
  Wand2,
  Copy,
  Check,
  CalendarPlus,
  Loader2,
  ExternalLink,
  ThumbsUp,
  Download,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { scoreColor, formatNumber } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format } from 'date-fns'

type Draft = {
  id: string
  xContent: string | null
  linkedinContent: string | null
  imageHeadline: string | null
  imageSubheadline: string | null
  imageFooter: string | null
  status: string
  similarityScore: number | null
  idea: {
    id: string
    overallScore: number
    category: string
    coreIdea: string
    reason: string
    comment: {
      text: string
      author: string
      likeCount: number
      videoTitle: string
      url?: string
      source?: { name: string }
    }
  }
  scheduledPosts: {
    id: string
    platform: string
    status: string
    scheduledAt?: string
  }[]
}

const REFINE_ACTIONS = [
  { label: 'Shorten', value: 'shorten' },
  { label: 'Expand', value: 'expand' },
  { label: 'More controversial', value: 'make more controversial' },
  { label: 'Simplify', value: 'simplify' },
  { label: 'Alternative hook', value: 'create alternative hook' },
  { label: 'More conversational', value: 'make more conversational' },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="ghost" size="icon-sm" onClick={handleCopy} title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  )
}

export function DraftEditor({ draft: initialDraft }: { draft: Draft }) {
  const router = useRouter()
  const [draft, setDraft] = useState(initialDraft)
  const [saving, setSaving] = useState(false)
  const [refining, setRefining] = useState<string | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueData, setQueueData] = useState({
    platform: 'X' as 'X' | 'LINKEDIN',
    scheduledAt: '',
  })
  const [queueing, setQueueing] = useState(false)
  const [templateId, setTemplateId] = useState('tweet-card')
  const [imageFormat, setImageFormat] = useState('SQUARE')
  const [downloading, setDownloading] = useState(false)

  // Fetch creator profile settings so the image card uses real name/handle/avatar
  const [profile, setProfile] = useState({ authorName: 'Creator', authorHandle: '@creator', authorAvatarUrl: '' })
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        const s = d as { authorName?: string; authorHandle?: string; authorAvatarUrl?: string }
        setProfile({
          authorName: s.authorName || 'Creator',
          authorHandle: s.authorHandle || '@creator',
          authorAvatarUrl: s.authorAvatarUrl || '',
        })
      })
      .catch(() => {})
  }, [])

  const save = async (updates: Partial<typeof draft>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Save failed')
      setDraft((prev) => ({ ...prev, ...updates }))
      toast({ title: 'Saved', variant: 'success' })
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const refine = async (content: string, instruction: string, platform: 'x' | 'linkedin') => {
    const key = `${platform}-${instruction}`
    setRefining(key)
    try {
      const res = await fetch(`/api/drafts/${draft.id}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, instruction, platform }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'Refine failed')
      if (platform === 'x') {
        setDraft((p) => ({ ...p, xContent: data.content ?? p.xContent }))
      } else {
        setDraft((p) => ({ ...p, linkedinContent: data.content ?? p.linkedinContent }))
      }
      toast({ title: 'Content refined', variant: 'success' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
    } finally {
      setRefining(null)
    }
  }

  const addToQueue = async () => {
    setQueueing(true)
    try {
      const content = queueData.platform === 'X' ? draft.xContent : draft.linkedinContent
      if (!content) throw new Error('No content for this platform')
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: draft.id,
          platform: queueData.platform,
          content,
          scheduledAt: queueData.scheduledAt || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to queue')
      toast({ title: 'Added to queue!', variant: 'success' })
      setQueueOpen(false)
      router.refresh()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
    } finally {
      setQueueing(false)
    }
  }

  const imagePreviewUrl = `/api/image-preview?templateId=${templateId}&format=${imageFormat}&headline=${encodeURIComponent(draft.imageHeadline || '')}&subheadline=${encodeURIComponent(draft.imageSubheadline || '')}&author=${encodeURIComponent(profile.authorName)}&handle=${encodeURIComponent(profile.authorHandle)}&category=${encodeURIComponent(draft.idea.category)}&avatarUrl=${encodeURIComponent(profile.authorAvatarUrl)}&postBody=${encodeURIComponent(draft.xContent || draft.imageHeadline || '')}`

  const downloadImage = async (ext: 'png' | 'jpg') => {
    setDownloading(true)
    try {
      const res = await fetch('/api/image-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          format: imageFormat,
          headline: draft.imageHeadline || '',
          subheadline: draft.imageSubheadline || '',
          author: profile.authorName,
          handle: profile.authorHandle,
          category: draft.idea.category,
          avatarUrl: profile.authorAvatarUrl,
          verified: true,
          postBody: draft.xContent || draft.imageHeadline || '',
          ext,
        }),
      })

      if (res.status === 422) {
        // No Chrome found — open preview in browser as fallback
        window.open(imagePreviewUrl, '_blank')
        toast({
          title: 'Chrome not found',
          description: 'Opened in browser — right-click the image and save, or use Print → Save as PDF.',
          variant: 'default',
        })
        return
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' })) as { error?: string }
        throw new Error(err.error || 'Export failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `post-card.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: `Downloaded as ${ext.toUpperCase()}`, variant: 'success' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Download failed', variant: 'destructive' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="px-8 py-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main editor - 2/3 width */}
        <div className="xl:col-span-2 space-y-4">
          {/* Source card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="default" className="text-[10px]">{draft.idea.category}</Badge>
                    <span className={`text-sm font-semibold ${scoreColor(draft.idea.overallScore)}`}>
                      {draft.idea.overallScore.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-zinc-200">{draft.idea.coreIdea}</p>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{draft.idea.reason}</p>
                </div>
              </div>
              <details className="mt-3">
                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400 select-none">
                  View original comment
                </summary>
                <div className="mt-2 p-3 bg-zinc-800/40 rounded-md">
                  <p className="text-sm text-zinc-300 italic">&ldquo;{draft.idea.comment.text}&rdquo;</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-600">
                    <ThumbsUp className="w-3 h-3" />
                    {formatNumber(draft.idea.comment.likeCount)}
                    <span>· {draft.idea.comment.author}</span>
                    <span>· {draft.idea.comment.videoTitle}</span>
                    {draft.idea.comment.url && (
                      <a href={draft.idea.comment.url} target="_blank" rel="noopener noreferrer"
                        className="hover:text-indigo-400 ml-auto">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>

          {/* Editor tabs */}
          <Tabs defaultValue="x">
            <TabsList>
              <TabsTrigger value="x">
                <Share2 className="w-3.5 h-3.5 text-sky-400" />
                X Post
              </TabsTrigger>
              <TabsTrigger value="linkedin">
                <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                LinkedIn
              </TabsTrigger>
              <TabsTrigger value="image">
                <Image className="w-3.5 h-3.5 text-purple-400" />
                Image
              </TabsTrigger>
            </TabsList>

            {/* X Tab */}
            <TabsContent value="x">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {(draft.xContent?.length ?? 0)} / 280 chars
                    </span>
                    <div className="flex items-center gap-1">
                      <CopyButton text={draft.xContent ?? ''} />
                    </div>
                  </div>
                  <Textarea
                    className="min-h-[120px] font-mono text-sm"
                    value={draft.xContent ?? ''}
                    onChange={(e) => setDraft((p) => ({ ...p, xContent: e.target.value }))}
                    placeholder="Your X post..."
                    maxLength={560}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {REFINE_ACTIONS.map((action) => (
                      <Button
                        key={action.value}
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2.5 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700"
                        disabled={refining !== null}
                        onClick={() => refine(draft.xContent ?? '', action.value, 'x')}
                      >
                        {refining === `x-${action.value}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3 mr-1 opacity-60" />
                        )}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => save({ xContent: draft.xContent })}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setQueueData((p) => ({ ...p, platform: 'X' })); setQueueOpen(true) }}
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Add to Queue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LinkedIn Tab */}
            <TabsContent value="linkedin">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {(draft.linkedinContent?.length ?? 0)} chars
                    </span>
                    <CopyButton text={draft.linkedinContent ?? ''} />
                  </div>
                  <Textarea
                    className="min-h-[200px] text-sm"
                    value={draft.linkedinContent ?? ''}
                    onChange={(e) => setDraft((p) => ({ ...p, linkedinContent: e.target.value }))}
                    placeholder="Your LinkedIn post..."
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {REFINE_ACTIONS.map((action) => (
                      <Button
                        key={action.value}
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2.5 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700"
                        disabled={refining !== null}
                        onClick={() => refine(draft.linkedinContent ?? '', action.value, 'linkedin')}
                      >
                        {refining === `linkedin-${action.value}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3 mr-1 opacity-60" />
                        )}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => save({ linkedinContent: draft.linkedinContent })}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setQueueData((p) => ({ ...p, platform: 'LINKEDIN' })); setQueueOpen(true) }}
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Add to Queue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Image Tab */}
            <TabsContent value="image">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1.5 block">Template</label>
                      <Select value={templateId} onValueChange={setTemplateId}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tweet-card">Tweet Card</SelectItem>
                          <SelectItem value="minimal-dark">Minimal Dark</SelectItem>
                          <SelectItem value="clean-light">Clean Light</SelectItem>
                          <SelectItem value="gradient-accent">Gradient Accent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1.5 block">Format</label>
                      <Select value={imageFormat} onValueChange={setImageFormat}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SQUARE">Square (1080×1080)</SelectItem>
                          <SelectItem value="LINKEDIN_PORTRAIT">LinkedIn Portrait (1080×1350)</SelectItem>
                          <SelectItem value="X_LANDSCAPE">X Landscape (1600×900)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Tweet Card uses the X post body — show info instead of headline/sub fields */}
                  {templateId === 'tweet-card' ? (
                    <div className="p-3 rounded-md bg-zinc-800/50 border border-zinc-700 text-xs text-zinc-400 space-y-1">
                      <p className="font-medium text-zinc-300">Tweet Card uses your X post content</p>
                      <p>Profile: <span className="text-zinc-200">{profile.authorName}</span> · <span className="text-zinc-200">{profile.authorHandle}</span></p>
                      {profile.authorAvatarUrl
                        ? <p className="text-emerald-400">✓ Avatar photo set</p>
                        : <p className="text-yellow-400">⚠ No avatar — upload one in Settings → Creator Profile</p>
                      }
                      <div className="flex items-center justify-between pt-0.5">
                        <p className="text-zinc-500">Edit the X Post tab to change the card text.</p>
                        <span className={`font-mono ${(draft.xContent?.length ?? 0) > 400 ? 'text-red-400' : 'text-zinc-500'}`}>
                          {draft.xContent?.length ?? 0} / 400 chars
                        </span>
                      </div>
                      {(draft.xContent?.length ?? 0) > 400 && (
                        <p className="text-red-400">Text exceeds 400 chars — it will be truncated with … in the image.</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs text-zinc-400 mb-1.5 block">Headline</label>
                        <Input
                          value={draft.imageHeadline ?? ''}
                          onChange={(e) => setDraft((p) => ({ ...p, imageHeadline: e.target.value }))}
                          placeholder="THE NEXT AI SKILL ISN'T PROMPTING."
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400 mb-1.5 block">Subheadline</label>
                        <Input
                          value={draft.imageSubheadline ?? ''}
                          onChange={(e) => setDraft((p) => ({ ...p, imageSubheadline: e.target.value }))}
                          placeholder="IT'S DELEGATION."
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400 mb-1.5 block">Footer (optional)</label>
                        <Input
                          value={draft.imageFooter ?? ''}
                          onChange={(e) => setDraft((p) => ({ ...p, imageFooter: e.target.value }))}
                          placeholder="@yourhandle"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex justify-between items-center pt-1 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => save({
                        imageHeadline: draft.imageHeadline,
                        imageSubheadline: draft.imageSubheadline,
                        imageFooter: draft.imageFooter,
                      })}
                      disabled={saving || templateId === 'tweet-card'}
                    >
                      {saving ? 'Saving...' : 'Save Text'}
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        asChild
                      >
                        <a href={imagePreviewUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Preview
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloading}
                        onClick={() => downloadImage('png')}
                      >
                        {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        PNG
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloading}
                        onClick={() => downloadImage('jpg')}
                      >
                        {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        JPG
                      </Button>
                    </div>
                  </div>

                  {/* Inline preview */}
                  <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 mt-2">
                    <p className="text-xs text-zinc-600 p-2 border-b border-zinc-800">Preview (scaled)</p>
                    <div className="relative w-full" style={{ paddingBottom: imageFormat === 'LINKEDIN_PORTRAIT' ? '125%' : imageFormat === 'X_LANDSCAPE' ? '56.25%' : '100%' }}>
                      <iframe
                        src={imagePreviewUrl}
                        className="absolute inset-0 w-full h-full border-0"
                        title="Image preview"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - 1/3 width */}
        <div className="space-y-4">
          {/* Queue status */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-zinc-400 font-medium mb-3">Queue</p>
              {draft.scheduledPosts.length === 0 ? (
                <p className="text-sm text-zinc-600">Not scheduled yet</p>
              ) : (
                <div className="space-y-2">
                  {draft.scheduledPosts.map((post) => (
                    <div key={post.id} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">{post.platform}</span>
                      <div className="flex items-center gap-2">
                        {post.scheduledAt && (
                          <span className="text-xs text-zinc-600 font-mono">
                            {format(new Date(post.scheduledAt), 'MMM d HH:mm')}
                          </span>
                        )}
                        <Badge variant="default" className="text-[10px]">{post.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-zinc-400 font-medium mb-3">Quick Actions</p>
              <Button
                className="w-full justify-start"
                variant="outline"
                size="sm"
                onClick={() => { setQueueData((p) => ({ ...p, platform: 'X' })); setQueueOpen(true) }}
              >
                <Share2 className="w-3.5 h-3.5 text-sky-400" />
                Queue X Post
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                size="sm"
                onClick={() => { setQueueData((p) => ({ ...p, platform: 'LINKEDIN' })); setQueueOpen(true) }}
              >
                <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                Queue LinkedIn Post
              </Button>
              <Button
                className="w-full justify-start"
                variant="success"
                size="sm"
                onClick={() => save({ status: 'APPROVED' })}
                disabled={draft.status === 'APPROVED' || saving}
              >
                Approve Draft
              </Button>
            </CardContent>
          </Card>

          {draft.similarityScore !== null && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-zinc-400 font-medium mb-1">Similarity to source</p>
                <p className={`text-xl font-bold ${draft.similarityScore < 0.4 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {Math.round((draft.similarityScore ?? 0) * 100)}%
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  {draft.similarityScore < 0.4 ? 'Highly original ✓' : 'Somewhat similar to source'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Queue Dialog */}
      <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Queue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Platform</label>
              <Select
                value={queueData.platform}
                onValueChange={(v) => setQueueData((p) => ({ ...p, platform: v as 'X' | 'LINKEDIN' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="X">X (Twitter)</SelectItem>
                  <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                Schedule for (leave empty for manual)
              </label>
              <Input
                type="datetime-local"
                value={queueData.scheduledAt}
                onChange={(e) => setQueueData((p) => ({ ...p, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setQueueOpen(false)}>Cancel</Button>
              <Button onClick={addToQueue} disabled={queueing}>
                {queueing ? 'Adding...' : 'Add to Queue'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
