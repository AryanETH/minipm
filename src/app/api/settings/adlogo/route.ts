import { NextRequest, NextResponse } from 'next/server'
import { setSetting } from '@/lib/settings'

export const runtime = 'nodejs'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
const MAX     = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const fd   = await req.formData()
    const file = fd.get('logo') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (!ALLOWED.includes(file.type))
      return NextResponse.json({ error: 'JPEG, PNG, WebP or SVG only' }, { status: 400 })
    if (file.size > MAX)
      return NextResponse.json({ error: 'Max 5 MB' }, { status: 400 })

    const ext = file.type === 'image/svg+xml' ? 'svg'
      : file.type === 'image/png' ? 'png'
      : file.type === 'image/webp' ? 'webp'
      : 'jpg'

    // Store as base64 data URI in the database — works on read-only filesystems (Vercel)
    const buffer = Buffer.from(await file.arrayBuffer())
    const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`

    await setSetting('advertLogoUrl' as never, dataUri as never)

    const url = `/api/files/adlogo.${ext}`
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
