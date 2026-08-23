import { NextRequest, NextResponse } from 'next/server'
import { getAllSettings, setSettings } from '@/lib/settings'

export const runtime = 'nodejs'

// Convert data URIs stored in settings to lightweight /api/files/ serving URLs
// so the settings response doesn't include megabytes of base64
function sanitiseForClient(settings: Record<string, unknown>): Record<string, unknown> {
  const result = { ...settings }

  const imageFields: Record<string, string> = {
    authorAvatarUrl: 'avatar',
    advertLogoUrl:   'adlogo',
    bgImageUrl:      'bgimage',
  }

  for (const [field, slug] of Object.entries(imageFields)) {
    const val = result[field]
    if (typeof val === 'string' && val.startsWith('data:')) {
      // Extract mime type to build the right extension
      const mime = val.split(';')[0].replace('data:', '')
      const ext = mime === 'image/jpeg' ? 'jpg'
        : mime === 'image/png' ? 'png'
        : mime === 'image/webp' ? 'webp'
        : mime === 'image/gif' ? 'gif'
        : mime === 'image/svg+xml' ? 'svg'
        : 'png'
      result[field] = `/api/files/${slug}.${ext}?t=${Date.now()}`
    }
  }

  return result
}

export async function GET() {
  const settings = await getAllSettings()
  const client = sanitiseForClient(settings as unknown as Record<string, unknown>)
  return NextResponse.json({
    ...client,
    youtubeApiKey: settings.youtubeApiKey ? '***configured***' : '',
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // Don't overwrite the actual key if the masked value is sent back
  if (body.youtubeApiKey === '***configured***') {
    delete body.youtubeApiKey
  }
  // Don't overwrite image data URIs if a /api/files/ URL is sent back
  for (const field of ['authorAvatarUrl', 'advertLogoUrl', 'bgImageUrl']) {
    if (typeof body[field] === 'string' && body[field].includes('/api/files/')) {
      delete body[field]
    }
  }
  await setSettings(body)
  return NextResponse.json({ ok: true })
}
