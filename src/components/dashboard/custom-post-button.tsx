'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react'
import {
  PenLine,
  X,
  Download,
  ExternalLink,
  Loader2,
  Bold,
  Italic,
  Underline,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { getLocalImage } from '@/lib/local-images'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CHAR_LIMIT = 400

const FORMAT_OPTIONS = [
  { value: 'SQUARE', label: 'Square (1080×1080)' },
  { value: 'LINKEDIN_PORTRAIT', label: 'LinkedIn Portrait (1080×1350)' },
  { value: 'X_LANDSCAPE', label: 'X Landscape (1600×900)' },
]

const ASPECT: Record<string, string> = {
  SQUARE: '100%',
  LINKEDIN_PORTRAIT: '125%',
  X_LANDSCAPE: '56.25%',
}

interface Profile {
  authorName: string
  authorHandle: string
  authorAvatarUrl: string
}

// ─── Serialise contenteditable HTML → markdown tokens ────────────────────────
// Walks the DOM of the editable div and converts <b>/<strong> → **text**,
// <i>/<em> → _text_, <u> → __text__, <br>/block elements → \n
// This way the image template receives markdown it already knows how to render.
function htmlToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const inner = Array.from(el.childNodes).map(htmlToMarkdown).join('')

  if (tag === 'br') return '\n'
  if (tag === 'div' || tag === 'p') {
    // Block elements add a newline after their content (but not the very first)
    return inner + '\n'
  }
  if (tag === 'b' || tag === 'strong') return `**${inner}**`
  if (tag === 'i' || tag === 'em') return `_${inner}_`
  if (tag === 'u') return `__${inner}__`
  return inner
}

// ─── Deserialise markdown tokens → HTML for contenteditable ─────────────────
function markdownToHtml(md: string): string {
  // Escape HTML special chars first (except we need to preserve the tokens)
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .replace(/__([^_]+?)__/g, '<u>$1</u>')
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}

// Plain text (strip markdown tokens) for char counting
function plainText(md: string): string {
  return md.replace(/\*\*|__|_/g, '')
}

// ─── Toolbar button ───────────────────────────────────────────────────────────
function ToolbarBtn({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void
  title: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault() // prevent editor losing focus
        onClick()
      }}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-indigo-600/30 text-indigo-300'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CustomPostButton() {
  const [open, setOpen] = useState(false)
  // markdown string — single source of truth for API / char count
  const [markdown, setMarkdown] = useState('')
  const [format, setFormat] = useState('SQUARE')
  const [profile, setProfile] = useState<Profile>({
    authorName: 'Creator',
    authorHandle: '@creator',
    authorAvatarUrl: '',
  })
  const [downloading, setDownloading] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  // Load profile once when dialog opens
  useEffect(() => {
    if (!open) return
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        const s = d as Partial<Profile>
        setProfile({
          authorName:      s.authorName    || 'Creator',
          authorHandle:    s.authorHandle  || '@creator',
          authorAvatarUrl: getLocalImage('avatar'),  // read from browser storage
        })
      })
      .catch(() => {
        setProfile(p => ({ ...p, authorAvatarUrl: getLocalImage('avatar') }))
      })
  }, [open])

  // Sync markdown → editor HTML only on first open (don't clobber cursor)
  const initialised = useRef(false)
  useEffect(() => {
    if (open && !initialised.current && editorRef.current) {
      editorRef.current.innerHTML = markdownToHtml(markdown)
      initialised.current = true
    }
    if (!open) initialised.current = false
  }, [open, markdown])

  // Read editor content → update markdown state
  const syncFromEditor = useCallback(() => {
    if (!editorRef.current) return
    let md = htmlToMarkdown(editorRef.current).trimEnd()
    // Normalise: remove trailing lone newline the browser appends
    if (md.endsWith('\n')) md = md.slice(0, -1)
    setMarkdown(md)
  }, [])

  // Apply a format command (bold / italic / underline) via execCommand
  const applyFormat = useCallback((command: 'bold' | 'italic' | 'underline') => {
    editorRef.current?.focus()
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(command, false)
    syncFromEditor()
  }, [syncFromEditor])

  const plain = plainText(markdown)
  const charCount = plain.length
  const isOver = charCount > CHAR_LIMIT

  const previewParams = useMemo(() => ({
    templateId: 'tweet-card',
    format,
    postBody: markdown,
    author: profile.authorName,
    handle: profile.authorHandle,
    avatarUrl: profile.authorAvatarUrl,
    verified: true,
    headline: '',
    subheadline: '',
    category: '',
  }), [markdown, format, profile])

  // Blob URL for the iframe preview
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
      } catch { /* ignore */ }
    }, 300)
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current) }
  }, [previewParams, markdown])

  const download = async (ext: 'png' | 'jpg') => {
    if (!markdown.trim()) {
      toast({ title: 'Enter some text first', variant: 'destructive' })
      return
    }
    setDownloading(true)
    try {
      const res = await fetch('/api/image-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...previewParams, ext }),
      })

      if (res.status === 422) {
        if (previewBlobUrl) window.open(previewBlobUrl, '_blank')
        toast({
          title: 'Chrome not found',
          description: 'Opened in browser — right-click to save.',
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
      a.download = `custom-post.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: `Downloaded as ${ext.toUpperCase()}`, variant: 'success' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Download failed', variant: 'destructive' })
    } finally {
      setDownloading(false)
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" size="sm" className="gap-2">
        <PenLine className="w-4 h-4 text-indigo-400" />
        Custom Post
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Dialog header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <PenLine className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Custom Post Image</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: controls ── */}
          <div className="w-80 flex-shrink-0 border-r border-zinc-800 flex flex-col p-5 gap-4 overflow-y-auto">

            {/* Rich text editor */}
            <div className="flex flex-col gap-1.5">
              {/* Label row */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">Post text</label>
                <span className={`text-xs font-mono tabular-nums ${
                  isOver ? 'text-red-400' : charCount >= CHAR_LIMIT - 50 ? 'text-yellow-400' : 'text-zinc-500'
                }`}>
                  {charCount} / {CHAR_LIMIT}
                </span>
              </div>

              {/* Formatting toolbar */}
              <div className="flex items-center gap-0.5 px-1 py-1 bg-zinc-800 border border-zinc-700 rounded-t-md border-b-0">
                <ToolbarBtn title="Bold (Ctrl+B)" onClick={() => applyFormat('bold')}>
                  <Bold className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Italic (Ctrl+I)" onClick={() => applyFormat('italic')}>
                  <Italic className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Underline (Ctrl+U)" onClick={() => applyFormat('underline')}>
                  <Underline className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <span className="ml-auto text-[10px] text-zinc-600 pr-1 select-none">
                  Ctrl+B / I / U
                </span>
              </div>

              {/* contenteditable editor */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncFromEditor}
                onKeyDown={(e) => {
                  // Let browser handle Ctrl+B/I/U natively, then sync
                  if ((e.ctrlKey || e.metaKey) && ['b','i','u'].includes(e.key.toLowerCase())) {
                    // sync after the browser applies the format
                    setTimeout(syncFromEditor, 0)
                  }
                }}
                onPaste={(e) => {
                  // Intercept paste: strip external HTML, keep only plain text
                  // (user can re-apply their own formatting)
                  e.preventDefault()
                  const plain = e.clipboardData.getData('text/plain')
                  // eslint-disable-next-line @typescript-eslint/no-deprecated
                  document.execCommand('insertText', false, plain)
                  syncFromEditor()
                }}
                data-placeholder="Write your post here…"
                className={[
                  'min-h-[180px] max-h-[260px] overflow-y-auto',
                  'px-3 py-2.5 text-sm text-zinc-100 bg-zinc-800',
                  'border border-zinc-700 rounded-b-md',
                  'focus:outline-none focus:ring-1 focus:ring-indigo-500',
                  'leading-relaxed',
                  // placeholder via CSS
                  'empty:before:content-[attr(data-placeholder)]',
                  'empty:before:text-zinc-600',
                  'empty:before:pointer-events-none',
                ].join(' ')}
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              />

              {isOver && (
                <p className="text-xs text-red-400">
                  Over limit by {charCount - CHAR_LIMIT} chars — image will truncate with …
                </p>
              )}
              <p className="text-[11px] text-zinc-600">
                Select text then click B / I / U, or use keyboard shortcuts.
                Copy-paste preserves plain text; re-apply formatting as needed.
              </p>
            </div>

            {/* Format selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Profile info */}
            <div className="p-3 rounded-md bg-zinc-800/50 border border-zinc-800 text-xs text-zinc-500 space-y-1">
              <p className="text-zinc-400 font-medium">Profile</p>
              <p>{profile.authorName} · {profile.authorHandle}</p>
              {profile.authorAvatarUrl
                ? <p className="text-emerald-400">✓ Avatar set</p>
                : <p className="text-yellow-500">⚠ No avatar — set one in Settings</p>
              }
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 mt-auto">
              <Button
                variant="secondary"
                size="sm"
                className="w-full gap-2"
                onClick={() => previewBlobUrl && window.open(previewBlobUrl, '_blank')}
                disabled={!markdown.trim()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open full size
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={downloading || !markdown.trim()}
                  onClick={() => download('png')}
                >
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={downloading || !markdown.trim()}
                  onClick={() => download('jpg')}
                >
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  JPG
                </Button>
              </div>
            </div>
          </div>

          {/* ── Right: live preview ── */}
          <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800 flex-shrink-0">
              <p className="text-xs text-zinc-600">Live preview — formatting reflects in image</p>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              {markdown.trim() ? (
                <div className="w-full" style={{ maxWidth: '560px' }}>
                  <div
                    className="relative w-full rounded-lg overflow-hidden border border-zinc-800"
                    style={{ paddingBottom: ASPECT[format] }}
                  >
                    <iframe
                      key={previewBlobUrl}
                      src={previewBlobUrl}
                      className="absolute inset-0 w-full h-full border-0"
                      title="Custom post preview"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center text-zinc-600 select-none">
                  <PenLine className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Type your post text to see a preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
