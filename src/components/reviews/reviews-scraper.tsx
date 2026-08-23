'use client'

import { useState } from 'react'
import { Download, Loader2, Star, Search, FileText, Sheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'

interface Review {
  userName: string
  score: number
  content: string
  at: string
  thumbsUpCount: number
  reviewCreatedVersion: string
  replyContent: string
  repliedAt: string
}

const STAR_OPTIONS = [1, 2, 3, 4, 5]

const STAR_COLORS: Record<number, string> = {
  1: 'text-red-400 border-red-500/40 bg-red-500/10',
  2: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
  3: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  4: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  5: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
}

const STAR_ACTIVE: Record<number, string> = {
  1: 'border-red-500 bg-red-500/25 text-red-300',
  2: 'border-orange-500 bg-orange-500/25 text-orange-300',
  3: 'border-yellow-500 bg-yellow-500/25 text-yellow-300',
  4: 'border-blue-500 bg-blue-500/25 text-blue-300',
  5: 'border-emerald-500 bg-emerald-500/25 text-emerald-300',
}

function formatDate(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return iso }
}

function StarBadge({ score }: { score: number }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${STAR_COLORS[score] ?? 'text-zinc-400 border-zinc-600 bg-zinc-800'}`}>
      {score}<Star className="w-2.5 h-2.5 fill-current" />
    </span>
  )
}

export function ReviewsScraper() {
  const [appUrl,        setAppUrl]        = useState('')
  const [selectedStars, setSelectedStars] = useState<number[]>([1])
  const [count,         setCount]         = useState(500)
  const [scraping,      setScraping]      = useState(false)
  const [reviews,       setReviews]       = useState<Review[]>([])
  const [appId,         setAppId]         = useState('')
  const [search,        setSearch]        = useState('')

  const toggleStar = (s: number) =>
    setSelectedStars(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s].sort())

  const scrape = async () => {
    if (!appUrl.trim()) { toast({ title: 'Enter a Play Store URL or app ID', variant: 'destructive' }); return }
    if (!selectedStars.length) { toast({ title: 'Select at least one star rating', variant: 'destructive' }); return }
    setScraping(true)
    setReviews([])
    try {
      const res  = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appUrl: appUrl.trim(), stars: selectedStars, count }),
      })
      const data = await res.json() as { reviews?: Review[]; appId?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'Scrape failed')
      setReviews(data.reviews ?? [])
      setAppId(data.appId ?? '')
      toast({ title: `Fetched ${data.reviews?.length ?? 0} reviews`, variant: 'success' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    } finally {
      setScraping(false)
    }
  }

  // Client-side search filter
  const displayed = reviews.filter(r =>
    !search || r.content?.toLowerCase().includes(search.toLowerCase()) ||
    r.userName?.toLowerCase().includes(search.toLowerCase())
  )

  // ── Download helpers ──────────────────────────────────────────────────────
  const downloadCSV = () => {
    if (!reviews.length) return
    const headers = ['User Name', 'Star Rating', 'Review', 'Date', 'Thumbs Up', 'App Version', 'Dev Reply', 'Reply Date']
    const rows = reviews.map(r => [
      `"${(r.userName  || '').replace(/"/g, '""')}"`,
      r.score,
      `"${(r.content   || '').replace(/"/g, '""')}"`,
      formatDate(r.at),
      r.thumbsUpCount,
      `"${(r.reviewCreatedVersion || '').replace(/"/g, '""')}"`,
      `"${(r.replyContent || '').replace(/"/g, '""')}"`,
      r.repliedAt ? formatDate(r.repliedAt) : '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    triggerDownload(csv, `${appId || 'reviews'}_${selectedStars.join('-')}star.csv`, 'text/csv')
  }

  const downloadJSON = () => {
    if (!reviews.length) return
    const json = JSON.stringify(reviews, null, 2)
    triggerDownload(json, `${appId || 'reviews'}_${selectedStars.join('-')}star.json`, 'application/json')
  }

  function triggerDownload(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">

      {/* ── Top config bar ── */}
      <div className="flex-shrink-0 border-b border-zinc-800 px-6 py-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-green-600 flex items-center justify-center flex-shrink-0">
            <Star className="w-4 h-4 text-white fill-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">Play Store Reviews Scraper</p>
            <p className="text-[11px] text-zinc-500">Paste an app URL or ID, choose star ratings, and download</p>
          </div>
        </div>

        {/* Row 1: URL */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Play Store URL or App ID</label>
            <Input
              value={appUrl}
              onChange={e => setAppUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && scrape()}
              placeholder="https://play.google.com/store/apps/details?id=com.instagram.android  or  com.instagram.android"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Max reviews</label>
            <select
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="h-9 px-3 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {[100, 250, 500, 1000, 2000].map(n => (
                <option key={n} value={n}>{n.toLocaleString()} reviews</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Star selector + Scrape */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Star ratings to include</label>
            <div className="flex items-center gap-2">
              {STAR_OPTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStar(s)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all ${
                    selectedStars.includes(s) ? STAR_ACTIVE[s] : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                  }`}
                >
                  {s}<Star className={`w-3 h-3 ${selectedStars.includes(s) ? 'fill-current' : ''}`} />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedStars(selectedStars.length === 5 ? [] : [1,2,3,4,5])}
                className="px-2 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded-md transition-colors"
              >
                {selectedStars.length === 5 ? 'None' : 'All'}
              </button>
            </div>
          </div>

          <div className="ml-auto flex items-end gap-2 pb-0.5">
            <Button onClick={scrape} disabled={scraping} className="gap-2">
              {scraping
                ? <><Loader2 className="w-4 h-4 animate-spin" />Scraping…</>
                : <><Search className="w-4 h-4" />Scrape Reviews</>}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Results area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Results header */}
        {reviews.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 flex-shrink-0 gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-200">{reviews.length.toLocaleString()} reviews</span>
              <span className="text-xs text-zinc-500">{appId}</span>
              <div className="flex gap-1">
                {selectedStars.map(s => <StarBadge key={s} score={s} />)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search reviews…"
                className="h-7 text-xs w-48"
              />
              <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5">
                <Sheet className="w-3.5 h-3.5 text-emerald-400" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={downloadJSON} className="gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                JSON
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {scraping ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-600">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <p className="text-sm">Fetching reviews from Play Store…</p>
              <p className="text-xs text-zinc-700">This may take 10–30 seconds</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-700 select-none">
              <Star className="w-12 h-12 opacity-20" />
              <p className="text-sm font-medium text-zinc-500">No reviews yet</p>
              <p className="text-xs">Enter an app URL above and click Scrape Reviews</p>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  <th className="text-left px-4 py-2.5 text-zinc-400 font-medium w-32">User</th>
                  <th className="text-left px-3 py-2.5 text-zinc-400 font-medium w-16">Rating</th>
                  <th className="text-left px-3 py-2.5 text-zinc-400 font-medium">Review</th>
                  <th className="text-left px-3 py-2.5 text-zinc-400 font-medium w-24">Date</th>
                  <th className="text-left px-3 py-2.5 text-zinc-400 font-medium w-16">👍</th>
                  <th className="text-left px-3 py-2.5 text-zinc-400 font-medium w-24">Version</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((r, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 text-zinc-300 font-medium align-top truncate max-w-[128px]">
                      {r.userName || '—'}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <StarBadge score={r.score} />
                    </td>
                    <td className="px-3 py-3 text-zinc-300 align-top leading-relaxed max-w-md">
                      <p className="line-clamp-4">{r.content || '—'}</p>
                      {r.replyContent && (
                        <p className="mt-1.5 text-zinc-600 italic line-clamp-2">
                          ↳ Dev: {r.replyContent}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-zinc-500 align-top whitespace-nowrap">
                      {formatDate(r.at)}
                    </td>
                    <td className="px-3 py-3 text-zinc-500 align-top">
                      {r.thumbsUpCount > 0 ? r.thumbsUpCount.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-3 text-zinc-600 align-top font-mono">
                      {r.reviewCreatedVersion || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        {reviews.length > 0 && search && (
          <div className="flex-shrink-0 px-6 py-2 border-t border-zinc-800 text-xs text-zinc-600">
            Showing {displayed.length} of {reviews.length} reviews
          </div>
        )}
      </div>
    </div>
  )
}
