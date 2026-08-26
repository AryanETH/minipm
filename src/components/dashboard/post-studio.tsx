'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Bold, Italic, Underline, Download, ExternalLink, Loader2,
  Megaphone, ChevronDown, ChevronUp, Zap, Upload, ImageIcon, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TEMPLATE_METADATA } from '@/lib/images/templates'
import { getLocalImage, storeLocalImage, clearLocalImage } from '@/lib/local-images'

const CHAR_LIMIT = 400

const FORMATS = [
  { value: 'SQUARE',            label: 'Square 1:1'     },
  { value: 'LINKEDIN_PORTRAIT', label: 'Portrait 4:5'   },
  { value: 'X_LANDSCAPE',       label: 'Landscape 16:9' },
]

const CANVAS_SIZES: Record<string, { w: number; h: number }> = {
  SQUARE:            { w: 1080, h: 1080 },
  LINKEDIN_PORTRAIT: { w: 1080, h: 1350 },
  X_LANDSCAPE:       { w: 1600, h: 900  },
}

const AD_COLORS = [
  '#6366f1','#f97316','#10b981','#ef4444',
  '#8b5cf6','#0ea5e9','#f59e0b','#18181b',
]

// ─── Markdown helpers ─────────────────────────────────────────────────────────
function htmlToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const inner = Array.from(el.childNodes).map(htmlToMarkdown).join('')
  if (tag === 'br') return '\n'
  if (tag === 'div' || tag === 'p') return inner + '\n'
  if (tag === 'b' || tag === 'strong') return `**${inner}**`
  if (tag === 'i' || tag === 'em') return `_${inner}_`
  if (tag === 'u') return `__${inner}__`
  return inner
}

function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/__([^_]+?)__/g, '<u>$1</u>')
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}

function stripMd(md: string) { return md.replace(/\*\*|__|_/g, '') }

// ─── Scaled preview ───────────────────────────────────────────────────────────
function ScaledPreview({ src, fmt }: { src: string; fmt: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const cv = CANVAS_SIZES[fmt] || CANVAS_SIZES.SQUARE

  useEffect(() => {
    const recalc = () => {
      if (!wrapRef.current) return
      const sw = wrapRef.current.clientWidth / cv.w
      const sh = wrapRef.current.clientHeight / cv.h
      setScale(Math.min(sw, sh, 1))
    }
    recalc()
    const ro = new ResizeObserver(recalc)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [cv.w, cv.h])

  const dw = Math.round(cv.w * scale)
  const dh = Math.round(cv.h * scale)

  return (
    <div ref={wrapRef} className="w-full h-full flex items-center justify-center">
      <div
        className="rounded-xl overflow-hidden border border-zinc-800 shadow-2xl flex-shrink-0"
        style={{ width: dw, height: dh, position: 'relative' }}
      >
        <iframe
          key={src} src={src} title="Post preview"
          style={{
            width: cv.w, height: cv.h,
            border: 'none', position: 'absolute', top: 0, left: 0,
            transformOrigin: 'top left', transform: `scale(${scale})`,
          }}
        />
      </div>
    </div>
  )
}

// ─── Toolbar button ───────────────────────────────────────────────────────────
function TB({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
    >{children}</button>
  )
}

// ─── PostStudio ───────────────────────────────────────────────────────────────
export function PostStudio() {
  const [markdown, setMarkdown]     = useState('')
  const [format,   setFormat]       = useState('SQUARE')
  const [tplId,    setTplId]        = useState('tweet-card')
  const editorRef   = useRef<HTMLDivElement>(null)
  const initialised = useRef(false)

  const [profile, setProfile] = useState({ authorName: 'Creator', authorHandle: '@creator', authorAvatarUrl: '' })

  // Ad strip state
  const [adOpen,     setAdOpen]     = useState(false)
  const [adOn,       setAdOn]       = useState(false)
  const [adLogoUrl,  setAdLogoUrl]  = useState('')   // base64 data URI from localStorage
  const [adLogoText, setAdLogoText] = useState('')   // fallback text
  const [adTagline,  setAdTagline]  = useState('')
  const [adColor,    setAdColor]    = useState('#6366f1')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Yourstory template state
  const [bgImageUrl,    setBgImageUrl]    = useState('')  // base64 data URI from localStorage
  const [accentColor,   setAccentColor]   = useState('#22c55e')
  const [brandName,     setBrandName]     = useState('BRAND')
  const [categoryLabel, setCategoryLabel] = useState('NEWS')
  const [uploadingBg,   setUploadingBg]   = useState(false)

  const [downloading, setDownloading] = useState(false)

  // Load profile name/handle from API; images from localStorage
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((d: Record<string, string>) => setProfile({
        authorName:      d.authorName    || 'Creator',
        authorHandle:    d.authorHandle  || '@creator',
        authorAvatarUrl: getLocalImage('avatar'),  // always read from browser storage
      }))
      .catch(() => {
        setProfile(p => ({ ...p, authorAvatarUrl: getLocalImage('avatar') }))
      })

    // Load ad logo + bg image from localStorage
    setAdLogoUrl(getLocalImage('adlogo'))
    setBgImageUrl(getLocalImage('bgimage'))
  }, [])

  // Upload brand logo — stored in browser localStorage
  const uploadLogo = async (file: File) => {
    setUploadingLogo(true)
    try {
      const dataUri = await storeLocalImage('adlogo', file)
      setAdLogoUrl(dataUri)
      toast({ title: 'Brand logo saved in browser', variant: 'success' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' })
    } finally {
      setUploadingLogo(false)
    }
  }

  // Upload background image — stored in browser localStorage
  const uploadBg = async (file: File) => {
    setUploadingBg(true)
    try {
      const dataUri = await storeLocalImage('bgimage', file)
      setBgImageUrl(dataUri)
      toast({ title: 'Background image saved in browser', variant: 'success' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' })
    } finally {
      setUploadingBg(false)
    }
  }
  useEffect(() => {
    if (!initialised.current && editorRef.current) {
      editorRef.current.innerHTML = markdownToHtml(markdown)
      initialised.current = true
    }
  }, [markdown])

  const syncFromEditor = useCallback(() => {
    if (!editorRef.current) return
    let md = htmlToMarkdown(editorRef.current).trimEnd()
    if (md.endsWith('\n')) md = md.slice(0, -1)
    setMarkdown(md)
  }, [])

  const applyFmt = useCallback((cmd: 'bold' | 'italic' | 'underline') => {
    editorRef.current?.focus()
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false)
    syncFromEditor()
  }, [syncFromEditor])

  const charCount = stripMd(markdown).length
  const isOver    = charCount > CHAR_LIMIT

  // Build preview params (no avatar in URL — passed via POST to avoid huge query strings)
  const previewParams = useMemo(() => ({
    templateId: tplId, format,
    postBody: markdown,
    author: profile.authorName, handle: profile.authorHandle,
    avatarUrl: profile.authorAvatarUrl,   // data URI — passed in POST body only
    verified: true, headline: '', subheadline: '', category: '',
    advertMode: adOn,
    advertLogoUrl: adLogoUrl,
    advertLogoText: adLogoText,
    advertTagline: adTagline,
    advertBgColor: adColor,
    bgImageUrl,
    accentColor,
    brandName,
    categoryLabel,
  }), [markdown, format, tplId, profile, adOn, adLogoUrl, adLogoText, adTagline, adColor, bgImageUrl, accentColor, brandName, categoryLabel])

  // Blob URL for the iframe — fetched via POST so data URIs aren't in the query string
  const [previewBlobUrl, setPreviewBlobUrl] = useState('')
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!markdown.trim()) { setPreviewBlobUrl(''); return }
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/image-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(previewParams),
        })
        if (!res.ok) return
        const html = await res.text()
        const blob = new Blob([html], { type: 'text/html' })
        const url  = URL.createObjectURL(blob)
        setPreviewBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url })
      } catch { /* ignore preview errors */ }
    }, 300)
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current) }
  }, [previewParams, markdown])

  const download = async (ext: 'png' | 'jpg') => {
    if (!markdown.trim()) { toast({ title: 'Write something first', variant: 'destructive' }); return }
    setDownloading(true)
    try {
      const res = await fetch('/api/image-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...previewParams, ext }),
      })
      if (res.status === 422) {
        if (previewBlobUrl) window.open(previewBlobUrl, '_blank')
        toast({ title: 'Chrome not found', description: 'Opened in browser — right-click to save.', variant: 'default' })
        return
      }
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || 'Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `post.${ext}`; a.click()
      URL.revokeObjectURL(url)
      toast({ title: `Downloaded as ${ext.toUpperCase()}`, variant: 'success' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Download failed', variant: 'destructive' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">

      {/* ── Left panel ── */}
      <div className="w-80 flex-shrink-0 border-r border-zinc-800 flex flex-col overflow-y-auto">

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100 leading-tight">Post Studio</p>
            <p className="text-[10px] text-zinc-500 leading-tight">Image creator</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 p-5">

          {/* Rich text editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Post text</span>
              <span className={`text-xs font-mono ${isOver ? 'text-red-400' : charCount >= CHAR_LIMIT - 50 ? 'text-yellow-400' : 'text-zinc-600'}`}>
                {charCount}/{CHAR_LIMIT}
              </span>
            </div>
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-1.5 py-1 bg-zinc-800 border border-zinc-700 rounded-t-md border-b-0">
              <TB title="Bold (Ctrl+B)"      onClick={() => applyFmt('bold')}><Bold      className="w-3.5 h-3.5" /></TB>
              <TB title="Italic (Ctrl+I)"    onClick={() => applyFmt('italic')}><Italic    className="w-3.5 h-3.5" /></TB>
              <TB title="Underline (Ctrl+U)" onClick={() => applyFmt('underline')}><Underline className="w-3.5 h-3.5" /></TB>
              <span className="ml-auto text-[10px] text-zinc-600 pr-1 select-none">Ctrl+B/I/U</span>
            </div>
            {/* Editor */}
            <div
              ref={editorRef}
              contentEditable suppressContentEditableWarning
              onInput={syncFromEditor}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && ['b','i','u'].includes(e.key.toLowerCase()))
                  setTimeout(syncFromEditor, 0)
              }}
              onPaste={e => {
                e.preventDefault()
                // eslint-disable-next-line @typescript-eslint/no-deprecated
                document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
                syncFromEditor()
              }}
              data-placeholder="Write your post…"
              className={[
                'min-h-[160px] max-h-[240px] overflow-y-auto',
                'px-3 py-2.5 text-sm text-zinc-100 bg-zinc-800',
                'border border-zinc-700 rounded-b-md',
                'focus:outline-none focus:ring-1 focus:ring-indigo-500',
                'leading-relaxed whitespace-pre-wrap break-words',
                'empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-600 empty:before:pointer-events-none',
              ].join(' ')}
            />
            {isOver && <p className="text-xs text-red-400">Over by {charCount - CHAR_LIMIT} chars — image will truncate</p>}
          </div>

          {/* Layout + Format */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Layout</label>
              <Select value={tplId} onValueChange={setTplId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_METADATA.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Profile */}
          <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 text-xs text-zinc-500 space-y-1">
            <p className="text-zinc-400 font-medium">Profile</p>
            <p>{profile.authorName} · {profile.authorHandle}</p>
            {profile.authorAvatarUrl
              ? <p className="text-emerald-400">✓ Avatar set</p>
              : <p className="text-yellow-500">⚠ Upload avatar in Settings</p>}
          </div>

          {/* Yourstory controls — only shown when that template is active */}
          {tplId === 'yourstory' && (
            <div className="rounded-lg border border-zinc-700 overflow-hidden">
              <div className="px-3 py-2 bg-zinc-800/80 border-b border-zinc-700">
                <p className="text-xs font-medium text-zinc-300">Yourstory Settings</p>
              </div>
              <div className="p-3 space-y-3 bg-zinc-900/60">

                {/* Background photo */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-500">Background photo</label>
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-10 rounded bg-zinc-800 border border-zinc-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {bgImageUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={bgImageUrl} alt="bg" className="w-full h-full object-cover" />
                        : <ImageIcon className="w-4 h-4 text-zinc-600" />}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="bg-upload">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 cursor-pointer hover:border-zinc-500 transition-colors ${uploadingBg ? 'opacity-50 pointer-events-none' : ''}`}>
                          {uploadingBg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          {uploadingBg ? 'Uploading…' : 'Upload photo'}
                        </div>
                      </label>
                      <input id="bg-upload" type="file" accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadBg(f); e.target.value = '' }}
                      />
                      {bgImageUrl && (
                        <button type="button" onClick={() => setBgImageUrl('')}
                          className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors w-fit">
                          <X className="w-2.5 h-2.5" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Brand name */}
                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-500">Brand name (top-right)</label>
                  <Input value={brandName} onChange={e => setBrandName(e.target.value)}
                    placeholder="AITOYZ" className="h-7 text-xs" />
                </div>

                {/* Category label */}
                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-500">Category label (bottom bar)</label>
                  <Input value={categoryLabel} onChange={e => setCategoryLabel(e.target.value)}
                    placeholder="NEWS" className="h-7 text-xs" />
                </div>

                {/* Accent color */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-500">Accent color (corner squares)</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['#22c55e','#3b82f6','#f97316','#ef4444','#8b5cf6','#ec4899','#eab308','#ffffff'].map(c => (
                      <button key={c} type="button" onClick={() => setAccentColor(c)}
                        className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${accentColor === c ? 'border-white scale-110' : 'border-zinc-600'}`}
                        style={{ background: c }}
                      />
                    ))}
                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" title="Custom color" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-4 h-4 rounded flex-shrink-0" style={{ background: accentColor }} />
                    <span className="text-[10px] text-zinc-500 font-mono">{accentColor}</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Ad Strip */}
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <button type="button"
              onClick={() => setAdOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Megaphone className={`w-3.5 h-3.5 ${adOn ? 'text-indigo-400' : 'text-zinc-500'}`} />
                <span className="text-xs font-medium text-zinc-300">Ad Strip</span>
                {adOn && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-600/20 text-indigo-400">ON</span>}
              </div>
              {adOpen ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
            </button>

            {adOpen && (
              <div className="p-3 space-y-3 bg-zinc-900/60">
                {/* Toggle */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div onClick={() => setAdOn(v => !v)}
                    className={`w-8 h-4 rounded-full relative transition-colors ${adOn ? 'bg-indigo-600' : 'bg-zinc-700'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${adOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-xs text-zinc-400">Enable ad strip</span>
                </label>

                {adOn && (
                  <>
                    {/* Brand logo upload */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-500">Brand logo</label>
                      <div className="flex items-center gap-2">
                        {/* Preview */}
                        <div className="w-10 h-10 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {adLogoUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={adLogoUrl} alt="logo" className="w-full h-full object-contain p-1" />
                            : <ImageIcon className="w-4 h-4 text-zinc-600" />}
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <label htmlFor="ad-logo-upload">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 cursor-pointer hover:border-zinc-500 hover:text-zinc-100 transition-colors ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
                              {uploadingLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                              {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                            </div>
                          </label>
                          <input id="ad-logo-upload" type="file"
                            accept="image/jpeg,image/png,image/webp,image/svg+xml"
                            className="sr-only"
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }}
                          />
                          {adLogoUrl && (
                            <button type="button" onClick={() => setAdLogoUrl('')}
                              className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors w-fit">
                              <X className="w-2.5 h-2.5" /> Remove
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Fallback text if no logo */}
                      {!adLogoUrl && (
                        <Input value={adLogoText} onChange={e => setAdLogoText(e.target.value)}
                          placeholder="BRAND (text fallback)" className="h-7 text-xs mt-1" />
                      )}
                    </div>

                    {/* Tagline */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-500">Tagline</label>
                      <Input value={adTagline} onChange={e => setAdTagline(e.target.value)}
                        placeholder="Your one-line tagline" className="h-7 text-xs" />
                    </div>

                    {/* Color */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-500">Strip color</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {AD_COLORS.map(c => (
                          <button key={c} type="button" onClick={() => setAdColor(c)}
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${adColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ background: c }}
                          />
                        ))}
                        <input type="color" value={adColor} onChange={e => setAdColor(e.target.value)}
                          className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 bg-transparent" title="Custom color" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Download */}
          <div className="mt-auto space-y-2">
            <Button variant="secondary" size="sm" className="w-full gap-2"
              onClick={() => previewBlobUrl && window.open(previewBlobUrl, '_blank')} disabled={!markdown.trim()}>
              <ExternalLink className="w-3.5 h-3.5" /> Open full size
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="gap-1.5"
                disabled={downloading || !markdown.trim()} onClick={() => download('png')}>
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PNG
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5"
                disabled={downloading || !markdown.trim()} onClick={() => download('jpg')}>
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} JPG
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: preview ── */}
      <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">

        {/* Layout tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-800 overflow-x-auto flex-shrink-0">
          {TEMPLATE_METADATA.map(t => (
            <button key={t.id} type="button" onClick={() => setTplId(t.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap ${
                tplId === t.id
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/40'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-700'
              }`}
            >{t.name}</button>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-8">
          {markdown.trim() ? (
            <div className="w-full h-full flex flex-col items-center gap-3">
              <div className="flex-1 w-full min-h-0">
                <ScaledPreview src={previewBlobUrl} fmt={format} />
              </div>
              <p className="text-xs text-zinc-600 flex-shrink-0">
                {FORMATS.find(f => f.value === format)?.label} · {TEMPLATE_METADATA.find(t => t.id === tplId)?.name}
                {adOn && ' · Ad strip ON'}
              </p>
            </div>
          ) : (
            <div className="text-center text-zinc-700 select-none max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-base font-medium text-zinc-500 mb-1">Post Studio</p>
              <p className="text-sm">Type your post text on the left to see a live preview</p>
              <p className="text-xs mt-3 text-zinc-600">**bold** · _italic_ · __underline__</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
