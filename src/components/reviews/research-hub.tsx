'use client'

import { useState, useCallback } from 'react'
import {
  Loader2, Search, Download, Star, FileText, Sheet,
  ExternalLink, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'

// ─── Tool definitions ─────────────────────────────────────────────────────────

type ToolId =
  | 'playstore'
  | 'appstore'
  | 'reddit'
  | 'github'
  | 'hackernews'
  | 'playstore-meta'
  | 'instagram-dl'

interface Tool {
  id: ToolId
  name: string
  tagline: string
  color: string
  bgColor: string
  emoji: string
  inputLabel: string
  inputPlaceholder: string
  extraFields?: ExtraField[]
}

interface ExtraField {
  key: string
  label: string
  placeholder: string
  type?: 'text' | 'select'
  options?: { value: string; label: string }[]
}

const TOOLS: Tool[] = [
  {
    id: 'playstore',
    name: 'Play Store Reviews',
    tagline: 'Android app reviews with star filter',
    color: 'text-green-400',
    bgColor: 'bg-green-500',
    emoji: '▶',
    inputLabel: 'App URL or ID',
    inputPlaceholder: 'https://play.google.com/store/apps/details?id=com.instagram.android',
  },
  {
    id: 'appstore',
    name: 'App Store Reviews',
    tagline: 'iOS app reviews with star filter',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500',
    emoji: '🍎',
    inputLabel: 'App Store URL or numeric ID',
    inputPlaceholder: 'https://apps.apple.com/us/app/instagram/id389801252  or  389801252',
  },
  {
    id: 'reddit',
    name: 'Reddit Search',
    tagline: 'Find pain points, feature requests & competitor mentions',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500',
    emoji: '🟠',
    inputLabel: 'Search query',
    inputPlaceholder: '"I hate instagram" OR "instagram alternative" OR "wish instagram had"',
    extraFields: [
      { key: 'subreddit', label: 'Subreddit (optional)', placeholder: 'e.g. Instagram  (leave blank to search all)' },
      {
        key: 'sort', label: 'Sort', placeholder: '', type: 'select',
        options: [
          { value: 'new', label: 'New' },
          { value: 'top', label: 'Top' },
          { value: 'relevance', label: 'Relevance' },
        ],
      },
    ],
  },
  {
    id: 'github',
    name: 'GitHub Issues',
    tagline: 'Feature requests & bug reports from public repos',
    color: 'text-zinc-300',
    bgColor: 'bg-zinc-600',
    emoji: '🐙',
    inputLabel: 'Repository (owner/repo)',
    inputPlaceholder: 'microsoft/vscode  or  https://github.com/microsoft/vscode',
    extraFields: [
      { key: 'labels', label: 'Label filter (optional)', placeholder: 'bug, enhancement, feature-request' },
      {
        key: 'state', label: 'State', placeholder: '', type: 'select',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
          { value: 'all', label: 'All' },
        ],
      },
    ],
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    tagline: 'Developer sentiment on product launches & tools',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500',
    emoji: 'Y',
    inputLabel: 'Search query',
    inputPlaceholder: 'notion vs obsidian  or  chatgpt alternative',
    extraFields: [
      {
        key: 'type', label: 'Content type', placeholder: '', type: 'select',
        options: [
          { value: 'story', label: 'Stories' },
          { value: 'comment', label: 'Comments' },
          { value: 'ask_hn', label: 'Ask HN' },
          { value: 'show_hn', label: 'Show HN' },
        ],
      },
    ],
  },
  {
    id: 'playstore-meta',
    name: 'App Metadata Compare',
    tagline: 'Compare ratings, installs & versions across apps',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500',
    emoji: '📊',
    inputLabel: 'App IDs (one per line)',
    inputPlaceholder: 'com.instagram.android\ncom.zhiliaoapp.musically\ncom.snapchat.android',
  },
  {
    id: 'instagram-dl',
    name: 'Instagram Video',
    tagline: 'Download Instagram Reels & videos by URL',
    color: 'text-pink-400',
    bgColor: 'bg-gradient-to-br from-purple-500 to-pink-500',
    emoji: '📸',
    inputLabel: 'Instagram Reel / Post URL',
    inputPlaceholder: 'https://www.instagram.com/reel/ABC123xyz/',
  },
]

const COUNT_OPTIONS = [50, 100, 250, 500, 1000]
const STAR_OPTIONS  = [1, 2, 3, 4, 5]

const STAR_ACTIVE: Record<number, string> = {
  1: 'border-red-500 bg-red-500/25 text-red-300',
  2: 'border-orange-500 bg-orange-500/25 text-orange-300',
  3: 'border-yellow-500 bg-yellow-500/25 text-yellow-300',
  4: 'border-blue-500 bg-blue-500/25 text-blue-300',
  5: 'border-emerald-500 bg-emerald-500/25 text-emerald-300',
}
const STAR_COLORS: Record<number, string> = {
  1: 'text-red-400 border-red-500/40 bg-red-500/10',
  2: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
  3: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  4: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  5: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
}

// ─── Types for results ────────────────────────────────────────────────────────

interface ReviewRow {
  userName: string; score: number; content: string
  at: string; thumbsUpCount: number; reviewCreatedVersion: string
  replyContent?: string
}

interface PostRow {
  id: string | number; title: string; content: string
  author: string; score: number; numComments: number
  at: string; url: string; labels?: string; state?: string; subreddit?: string
}

interface AppMeta {
  appId: string; title: string; developer: string; score: number
  ratings: number; installs: string; version: string; updated: string
  genre: string; description: string; url: string; error?: string
}

interface InstagramVideo {
  url: string
  thumbnail: string
  caption: string
  downloadUrl: string
  width?: number
  height?: number
}

type ResultData =
  | { kind: 'reviews'; rows: ReviewRow[]; appId: string; stars: number[] }
  | { kind: 'posts';   rows: PostRow[];   label: string }
  | { kind: 'meta';    rows: AppMeta[] }
  | { kind: 'igvideo'; video: InstagramVideo }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return iso }
}

function StarBadge({ s }: { s: number }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${STAR_COLORS[s] ?? 'border-zinc-600 bg-zinc-800 text-zinc-400'}`}>
      {s}<Star className="w-2.5 h-2.5 fill-current" />
    </span>
  )
}

function triggerDownload(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function toCSV(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)
  return [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n')
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResearchHub() {
  const [activeTool, setActiveTool] = useState<ToolId>('playstore')
  const [input,      setInput]      = useState('')
  const [extras,     setExtras]     = useState<Record<string, string>>({ sort: 'new', state: 'open', type: 'story' })
  const [stars,      setStars]      = useState<number[]>([1, 2])
  const [count,      setCount]      = useState(100)
  const [scraping,   setScraping]   = useState(false)
  const [result,     setResult]     = useState<ResultData | null>(null)
  const [search,     setSearch]     = useState('')
  // Sort & filter state for results table
  const [sortBy,     setSortBy]     = useState<'date' | 'score' | 'thumbs'>('date')
  const [sortDir,    setSortDir]    = useState<'desc' | 'asc'>('desc')
  const [starFilter, setStarFilter] = useState<number | 'all'>('all')

  const tool = TOOLS.find(t => t.id === activeTool)!
  const isReviewTool = activeTool === 'playstore' || activeTool === 'appstore'
  const isMetaTool   = activeTool === 'playstore-meta'
  const isIGTool     = activeTool === 'instagram-dl'

  const switchTool = (id: ToolId) => {
    setActiveTool(id)
    setInput('')
    setResult(null)
    setSearch('')
  }

  const toggleStar = (s: number) =>
    setStars(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s].sort())

  const setExtra = (key: string, val: string) =>
    setExtras(prev => ({ ...prev, [key]: val }))

  const run = useCallback(async () => {
    if (!input.trim()) {
      toast({ title: `Enter ${tool.inputLabel.toLowerCase()}`, variant: 'destructive' })
      return
    }
    setScraping(true)
    setResult(null)
    try {
      let endpoint = ''
      let body: Record<string, unknown> = {}

      if (activeTool === 'playstore') {
        endpoint = '/api/reviews'
        body = { appUrl: input.trim(), stars, count }
      } else if (activeTool === 'appstore') {
        endpoint = '/api/research/appstore'
        body = { appUrl: input.trim(), stars, count }
      } else if (activeTool === 'reddit') {
        endpoint = '/api/research/reddit'
        body = { query: input.trim(), subreddit: extras.subreddit ?? '', sort: extras.sort ?? 'new', count }
      } else if (activeTool === 'github') {
        endpoint = '/api/research/github'
        body = { repo: input.trim(), labels: extras.labels ?? '', state: extras.state ?? 'open', count }
      } else if (activeTool === 'hackernews') {
        endpoint = '/api/research/hackernews'
        body = { query: input.trim(), type: extras.type ?? 'story', count }
      } else if (activeTool === 'playstore-meta') {
        endpoint = '/api/research/playstore-meta'
        const appIds = input.trim().split('\n').map(s => s.trim()).filter(Boolean)
        body = { appIds }
      } else if (activeTool === 'instagram-dl') {
        endpoint = '/api/research/instagram'
        body = { url: input.trim() }
      }

      const res  = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error(String(data.error) || 'Failed')

      if (activeTool === 'playstore' || activeTool === 'appstore') {
        setResult({ kind: 'reviews', rows: (data.reviews as ReviewRow[]) ?? [], appId: String(data.appId ?? ''), stars })
        toast({ title: `${(data.reviews as ReviewRow[])?.length ?? 0} reviews fetched`, variant: 'success' })
      } else if (activeTool === 'playstore-meta') {
        setResult({ kind: 'meta', rows: (data.apps as AppMeta[]) ?? [] })
        toast({ title: `${(data.apps as AppMeta[])?.length ?? 0} apps fetched`, variant: 'success' })
      } else if (activeTool === 'instagram-dl') {
        setResult({ kind: 'igvideo', video: data.video as InstagramVideo })
        toast({ title: 'Video info fetched — ready to download', variant: 'success' })
      } else {
        setResult({ kind: 'posts', rows: (data.posts as PostRow[]) ?? [], label: input.trim() })
        toast({ title: `${(data.posts as PostRow[])?.length ?? 0} results fetched`, variant: 'success' })
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    } finally {
      setScraping(false)
    }
  }, [activeTool, input, extras, stars, count, tool])

  // ── Download ──────────────────────────────────────────────────────────────
  const downloadCSV = () => {
    if (!result) return
    let csv = ''
    const slug = activeTool
    if (result.kind === 'reviews') {
      csv = toCSV(
        ['User', 'Stars', 'Review', 'Date', 'Thumbs Up', 'Version'],
        result.rows.map(r => [r.userName, r.score, r.content, fmt(r.at), r.thumbsUpCount, r.reviewCreatedVersion])
      )
      triggerDownload(csv, `${slug}-${result.appId}.csv`, 'text/csv')
    } else if (result.kind === 'posts') {
      csv = toCSV(
        ['Title', 'Author', 'Score', 'Comments', 'Date', 'URL', 'Content'],
        result.rows.map(r => [r.title, r.author, r.score, r.numComments, fmt(r.at), r.url, r.content])
      )
      triggerDownload(csv, `${slug}-results.csv`, 'text/csv')
    } else if (result.kind === 'meta') {
      csv = toCSV(
        ['App ID', 'Title', 'Developer', 'Score', 'Ratings', 'Installs', 'Version', 'Updated', 'Genre'],
        result.rows.map(r => [r.appId, r.title, r.developer, r.score, r.ratings, r.installs, r.version, r.updated, r.genre])
      )
      triggerDownload(csv, 'app-metadata.csv', 'text/csv')
    }
    // igvideo — no CSV export
  }

  const downloadJSON = () => {
    if (!result) return
    if (result.kind === 'igvideo') {
      triggerDownload(JSON.stringify(result.video, null, 2), `${activeTool}-result.json`, 'application/json')
      return
    }
    const rows = result.rows
    triggerDownload(JSON.stringify(rows, null, 2), `${activeTool}-results.json`, 'application/json')
  }

  // ── Filtered + sorted display ────────────────────────────────────────────
  const displayedReviews = result?.kind === 'reviews'
    ? (() => {
        let rows = result.rows.filter(r =>
          (starFilter === 'all' || r.score === starFilter) &&
          (!search || r.content?.toLowerCase().includes(search.toLowerCase()) ||
           r.userName?.toLowerCase().includes(search.toLowerCase()))
        )
        return [...rows].sort((a, b) => {
          if (sortBy === 'score')  return sortDir === 'desc' ? b.score - a.score : a.score - b.score
          if (sortBy === 'thumbs') return sortDir === 'desc' ? b.thumbsUpCount - a.thumbsUpCount : a.thumbsUpCount - b.thumbsUpCount
          const da = new Date(a.at).getTime(), db = new Date(b.at).getTime()
          return sortDir === 'desc' ? db - da : da - db
        })
      })()
    : []

  const displayedPosts = result?.kind === 'posts'
    ? (() => {
        let rows = result.rows.filter(r =>
          !search || r.title?.toLowerCase().includes(search.toLowerCase()) ||
          r.content?.toLowerCase().includes(search.toLowerCase())
        )
        return [...rows].sort((a, b) => {
          if (sortBy === 'score')  return sortDir === 'desc' ? b.score - a.score : a.score - b.score
          if (sortBy === 'thumbs') return sortDir === 'desc' ? b.numComments - a.numComments : a.numComments - b.numComments
          const da = new Date(a.at).getTime(), db = new Date(b.at).getTime()
          return sortDir === 'desc' ? db - da : da - db
        })
      })()
    : []

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">

      {/* ── Tool sidebar (200px) ── */}
      <div className="w-52 flex-shrink-0 border-r border-zinc-800 flex flex-col overflow-y-auto bg-zinc-900/50">
        <div className="px-4 py-4 border-b border-zinc-800">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Research Tools</p>
        </div>
        <nav className="p-2 space-y-0.5">
          {TOOLS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTool(t.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors group ${
                activeTool === t.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <span className={`w-7 h-7 rounded-md ${t.bgColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {t.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{t.name}</p>
              </div>
              {activeTool === t.id && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0 text-zinc-400" />}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Config panel */}
        <div className="flex-shrink-0 border-b border-zinc-800 px-6 py-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-lg ${tool.bgColor} flex items-center justify-center text-white text-sm font-bold`}>
              {tool.emoji}
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-100">{tool.name}</p>
              <p className="text-[11px] text-zinc-500">{tool.tagline}</p>
            </div>
          </div>

          {/* Main input */}
          <div className="grid grid-cols-1 gap-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-zinc-400">{tool.inputLabel}</label>
                {isMetaTool ? (
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={tool.inputPlaceholder}
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
                ) : (
                  <Input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && run()}
                    placeholder={tool.inputPlaceholder}
                    className="text-sm"
                  />
                )}
              </div>

              {/* Count picker — not shown for Instagram */}
              {!isIGTool && (
              <div className="space-y-1 flex-shrink-0">
                <label className="text-xs font-medium text-zinc-400">Max results</label>
                <select
                  value={count}
                  onChange={e => setCount(Number(e.target.value))}
                  className="h-9 px-3 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {COUNT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              )}
            </div>

            {/* Extra fields row */}
            {tool.extraFields && (
              <div className="flex gap-3 flex-wrap">
                {tool.extraFields.map(ef => (
                  <div key={ef.key} className="space-y-1 min-w-[140px]">
                    <label className="text-xs font-medium text-zinc-400">{ef.label}</label>
                    {ef.type === 'select' ? (
                      <select
                        value={extras[ef.key] ?? ef.options?.[0]?.value ?? ''}
                        onChange={e => setExtra(ef.key, e.target.value)}
                        className="h-8 px-2 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                      >
                        {ef.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <Input
                        value={extras[ef.key] ?? ''}
                        onChange={e => setExtra(ef.key, e.target.value)}
                        placeholder={ef.placeholder}
                        className="h-8 text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Star picker (reviews tools only) */}
            {isReviewTool && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">Star ratings</label>
                  <div className="flex gap-1.5">
                    {STAR_OPTIONS.map(s => (
                      <button key={s} type="button" onClick={() => toggleStar(s)}
                        className={`flex items-center gap-0.5 px-2.5 py-1 rounded border text-xs font-semibold transition-all ${
                          stars.includes(s) ? STAR_ACTIVE[s] : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                        }`}
                      >
                        {s}<Star className={`w-2.5 h-2.5 ${stars.includes(s) ? 'fill-current' : ''}`} />
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => setStars(stars.length === 5 ? [] : [1,2,3,4,5])}
                      className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded transition-colors"
                    >
                      {stars.length === 5 ? 'None' : 'All'}
                    </button>
                  </div>
                </div>
                <Button onClick={run} disabled={scraping} className="ml-auto gap-2 self-end">
                  {scraping ? <><Loader2 className="w-4 h-4 animate-spin" />Fetching…</> : <><Search className="w-4 h-4" />Fetch Reviews</>}
                </Button>
              </div>
            )}

            {!isReviewTool && (
              <div className="flex justify-end">
                <Button onClick={run} disabled={scraping} className="gap-2">
                  {scraping ? <><Loader2 className="w-4 h-4 animate-spin" />Fetching…</> : isIGTool ? <><Download className="w-4 h-4" />Fetch Video</> : <><Search className="w-4 h-4" />Run</>}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Results bar */}
          {result && result.kind !== 'igvideo' && (
            <div className="flex items-center justify-between px-6 py-2.5 border-b border-zinc-800 flex-shrink-0 gap-3 flex-wrap">
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="font-medium text-zinc-200">
                  {result.kind === 'reviews' ? displayedReviews.length : result.kind === 'posts' ? displayedPosts.length : result.kind === 'meta' ? result.rows.length : 0}
                  {' '}<span className="text-zinc-500">/ {result.kind === 'reviews' ? result.rows.length : result.kind === 'posts' ? result.rows.length : result.kind === 'meta' ? result.rows.length : 0} results</span>
                </span>
                {result.kind === 'reviews' && result.stars.map(s => <StarBadge key={s} s={s} />)}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Star filter — reviews only */}
                {result.kind === 'reviews' && (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-zinc-600 mr-0.5">Filter:</span>
                    {(['all',1,2,3,4,5] as (number|'all')[]).map(s => (
                      <button key={s} type="button" onClick={() => setStarFilter(s)}
                        className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                          starFilter === s
                            ? s === 'all' ? 'border-zinc-400 bg-zinc-700 text-zinc-100' : `${STAR_ACTIVE[s as number]}`
                            : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                        }`}>
                        {s === 'all' ? 'All' : `${s}★`}
                      </button>
                    ))}
                  </div>
                )}
                {/* Sort */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-zinc-600">Sort:</span>
                  {([
                    { v: 'date',   l: 'Date'  },
                    { v: 'score',  l: result.kind === 'reviews' ? 'Stars' : 'Score' },
                    { v: 'thumbs', l: result.kind === 'reviews' ? 'Thumbs' : 'Comments' },
                  ] as {v:'date'|'score'|'thumbs', l:string}[]).map(o => (
                    <button key={o.v} type="button"
                      onClick={() => { if (sortBy === o.v) setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortBy(o.v); setSortDir('desc') } }}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${sortBy === o.v ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}>
                      {o.l}{sortBy === o.v ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                    </button>
                  ))}
                </div>
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search…" className="h-7 text-xs w-36" />
                <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5">
                  <Sheet className="w-3.5 h-3.5 text-emerald-400" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={downloadJSON} className="gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-400" /> JSON
                </Button>
              </div>
            </div>
          )}

          {/* Table area */}
          <div className="flex-1 overflow-auto">
            {scraping ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-600">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="text-sm text-zinc-500">Fetching from {tool.name}…</p>
                <p className="text-xs text-zinc-700">May take 10–30 seconds</p>
              </div>
            ) : !result ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-700 select-none">
                <span className="text-5xl opacity-20">{tool.emoji}</span>
                <p className="text-sm font-medium text-zinc-500">{tool.name}</p>
                <p className="text-xs">{tool.tagline}</p>
              </div>
            ) : result.kind === 'reviews' ? (
              /* Reviews table */
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800">
                  <tr>
                    {['#','User','Rating','Review','Date','👍','Version'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-zinc-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedReviews.map((r, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 text-zinc-600 align-top tabular-nums w-10">{i + 1}</td>
                      <td className="px-4 py-3 text-zinc-300 font-medium align-top max-w-[120px] truncate">{r.userName||'—'}</td>
                      <td className="px-4 py-3 align-top"><StarBadge s={r.score} /></td>
                      <td className="px-4 py-3 text-zinc-300 align-top leading-relaxed max-w-lg">
                        <p className="line-clamp-4">{r.content||'—'}</p>
                        {r.replyContent && <p className="mt-1 text-zinc-600 italic line-clamp-2">↳ {r.replyContent}</p>}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 align-top whitespace-nowrap">{fmt(r.at)}</td>
                      <td className="px-4 py-3 text-zinc-500 align-top">{r.thumbsUpCount>0?r.thumbsUpCount:'—'}</td>
                      <td className="px-4 py-3 text-zinc-600 align-top font-mono">{r.reviewCreatedVersion||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : result.kind === 'posts' ? (
              /* Posts table */
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800">
                  <tr>
                    {['#','Title / Content','Author','Score','Date','Link'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-zinc-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedPosts.map((r, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 text-zinc-600 align-top tabular-nums w-10">{i + 1}</td>
                      <td className="px-4 py-3 align-top max-w-xl">
                        <p className="text-zinc-200 font-medium line-clamp-2">{r.title||r.content.slice(0,80)||'—'}</p>
                        {r.content && r.title && (
                          <p className="text-zinc-500 mt-1 line-clamp-3">{r.content}</p>
                        )}
                        {r.labels && <span className="mt-1 inline-block text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5">{r.labels}</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 align-top whitespace-nowrap">{String(r.author||'—')}</td>
                      <td className="px-4 py-3 text-zinc-400 align-top">
                        <span className="font-mono">{Number(r.score).toLocaleString()}</span>
                        {r.numComments > 0 && <span className="text-zinc-600 ml-1.5">· {r.numComments}💬</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 align-top whitespace-nowrap">{fmt(String(r.at))}</td>
                      <td className="px-4 py-3 align-top">
                        <a href={String(r.url)} target="_blank" rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : result.kind === 'igvideo' ? (
              /* Instagram Video downloader */
              <div className="flex flex-col items-center justify-center h-full p-8">
                <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  {result.video.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={result.video.thumbnail}
                      alt="Video thumbnail"
                      className="w-full aspect-video object-cover"
                    />
                  )}
                  <div className="p-5 space-y-4">
                    {result.video.caption && (
                      <p className="text-sm text-zinc-300 line-clamp-3">{result.video.caption}</p>
                    )}
                    <div className="flex items-center gap-3">
                      <a
                        href={result.video.downloadUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download Video
                      </a>
                      <a
                        href={result.video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    {result.video.width && result.video.height && (
                      <p className="text-[11px] text-zinc-600 text-center">{result.video.width} × {result.video.height}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* App metadata table */
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.rows.map((app, i) => (
                    <div key={i} className={`p-4 rounded-xl border ${app.error ? 'border-red-500/20 bg-red-500/5' : 'border-zinc-800 bg-zinc-900'}`}>
                      {app.error ? (
                        <div>
                          <p className="text-xs font-mono text-zinc-500">{app.appId}</p>
                          <p className="text-xs text-red-400 mt-1">{app.error}</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-sm font-semibold text-zinc-100">{app.title}</p>
                              <p className="text-xs text-zinc-500">{app.developer}</p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="text-lg font-bold text-amber-400">{Number(app.score).toFixed(1)}</p>
                              <p className="text-[10px] text-zinc-600">★</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div><span className="text-zinc-600">Ratings</span><br /><span className="text-zinc-300">{Number(app.ratings).toLocaleString()}</span></div>
                            <div><span className="text-zinc-600">Installs</span><br /><span className="text-zinc-300">{app.installs||'—'}</span></div>
                            <div><span className="text-zinc-600">Version</span><br /><span className="text-zinc-300 font-mono">{app.version||'—'}</span></div>
                            <div><span className="text-zinc-600">Genre</span><br /><span className="text-zinc-300">{app.genre||'—'}</span></div>
                          </div>
                          <p className="text-[11px] text-zinc-600 mt-2 line-clamp-2">{app.description}</p>
                          <div className="mt-2 flex justify-between items-center">
                            <span className="text-[10px] text-zinc-700">{app.appId}</span>
                            {app.url && (
                              <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {result && search && result.kind !== 'igvideo' && (
            <div className="flex-shrink-0 px-6 py-2 border-t border-zinc-800 text-xs text-zinc-600">
              Showing {result.kind==='reviews' ? displayedReviews.length : displayedPosts.length} of{' '}
              {result.kind==='reviews' ? result.rows.length : result.kind==='posts' ? result.rows.length : result.rows.length} results
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
