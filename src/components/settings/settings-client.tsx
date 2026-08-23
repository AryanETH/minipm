'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { CheckCircle2, Loader2, Upload, User, Pen } from 'lucide-react'

interface Settings {
  authorName: string
  authorHandle: string
  authorAvatarUrl: string
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-400 block">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-zinc-600">{hint}</p>}
    </div>
  )
}

export function SettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        const s = d as Record<string, string>
        setSettings({
          authorName: s.authorName || '',
          authorHandle: s.authorHandle || '',
          authorAvatarUrl: s.authorAvatarUrl || '',
        })
      })
  }, [])

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await fetch('/api/settings/avatar', { method: 'POST', body: fd })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setSettings(p => p ? { ...p, authorAvatarUrl: data.url! + '?t=' + Date.now() } : p)
      toast({ title: 'Avatar saved', variant: 'success' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: settings.authorName,
          authorHandle: settings.authorHandle,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast({ title: 'Profile saved', variant: 'success' })
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <div className="px-8 py-10 flex items-center gap-2 text-zinc-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pen className="w-4 h-4 text-indigo-400" />
            Creator Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Avatar */}
          <Field label="Profile photo" hint="Shown in tweet card images. JPEG / PNG / WebP up to 5 MB.">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-zinc-700 flex-shrink-0 bg-zinc-800 flex items-center justify-center">
                {settings.authorAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.authorAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-zinc-500" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="avatar-upload">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 cursor-pointer hover:border-zinc-500 hover:text-zinc-100 transition-colors ${uploadingAvatar ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploadingAvatar ? 'Uploading…' : 'Upload photo'}
                  </div>
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) uploadAvatar(file)
                    e.target.value = ''
                  }}
                />
                {settings.authorAvatarUrl && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Photo set
                  </span>
                )}
              </div>
            </div>
          </Field>

          {/* Name + Handle */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Display name">
              <Input
                value={settings.authorName}
                onChange={e => setSettings(p => p ? { ...p, authorName: e.target.value } : p)}
                placeholder="Your Name"
              />
            </Field>
            <Field label="Handle" hint="e.g. @yourhandle">
              <Input
                value={settings.authorHandle}
                onChange={e => setSettings(p => p ? { ...p, authorHandle: e.target.value } : p)}
                placeholder="@yourhandle"
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Profile'}
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
