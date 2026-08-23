'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ExternalLink, RefreshCw } from 'lucide-react'

export default function TemplatesPage() {
  const [templateId, setTemplateId] = useState('minimal-dark')
  const [format, setFormat] = useState('SQUARE')
  const [headline, setHeadline] = useState("THE NEXT AI SKILL ISN'T PROMPTING.")
  const [subheadline, setSubheadline] = useState("IT'S DELEGATION.")
  const [author, setAuthor] = useState('Creator')
  const [handle, setHandle] = useState('@creator')
  const [category, setCategory] = useState('AI')
  const [key, setKey] = useState(0)

  const previewUrl = `/api/image-preview?templateId=${templateId}&format=${format}&headline=${encodeURIComponent(headline)}&subheadline=${encodeURIComponent(subheadline)}&author=${encodeURIComponent(author)}&handle=${encodeURIComponent(handle)}&category=${encodeURIComponent(category)}&k=${key}`

  const aspectRatios: Record<string, number> = {
    SQUARE: 1,
    LINKEDIN_PORTRAIT: 1350 / 1080,
    X_LANDSCAPE: 900 / 1600,
  }

  return (
    <div>
      <PageHeader title="Templates" description="Image card templates for social posts" />
      <div className="px-8 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Template Settings</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Template</label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minimal-dark">Minimal Dark</SelectItem>
                      <SelectItem value="clean-light">Clean Light</SelectItem>
                      <SelectItem value="gradient-accent">Gradient Accent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Format</label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SQUARE">Square (1080×1080)</SelectItem>
                      <SelectItem value="LINKEDIN_PORTRAIT">LinkedIn Portrait (1080×1350)</SelectItem>
                      <SelectItem value="X_LANDSCAPE">X Landscape (1600×900)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Headline</label>
                  <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Subheadline</label>
                  <Input value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Author</label>
                  <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Handle</label>
                  <Input value={handle} onChange={(e) => setHandle(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Category</label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={() => setKey((k) => k + 1)} variant="outline" size="sm">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                  </Button>
                  <Button size="sm" asChild>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Full Size
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Template Guide</CardTitle></CardHeader>
              <CardContent className="text-xs text-zinc-500 space-y-1.5">
                <p><strong className="text-zinc-400">Minimal Dark</strong> — Dark background with indigo accents. Best for AI/tech content.</p>
                <p><strong className="text-zinc-400">Clean Light</strong> — Minimal white design with bold left-border typography.</p>
                <p><strong className="text-zinc-400">Gradient Accent</strong> — Deep gradient with glowing circle accent. Premium feel.</p>
                <p className="mt-3 text-zinc-600">
                  To save as PNG, open in browser and use browser&apos;s save/screenshot. 
                  Playwright-based PNG export is available in Phase 2.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="xl:col-span-2">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-zinc-800">
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div
                  className="w-full bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800"
                  style={{ paddingBottom: `${aspectRatios[format] * 100}%`, position: 'relative' }}
                >
                  <iframe
                    key={key}
                    src={previewUrl}
                    className="absolute inset-0 w-full h-full border-0"
                    title="Template preview"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
