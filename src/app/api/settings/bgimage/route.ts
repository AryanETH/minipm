import { NextRequest, NextResponse } from 'next/server'
import { setSetting } from '@/lib/settings'

export const runtime = 'nodejs'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX     = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
    const fd   = await req.formData()
    const file = fd.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (!ALLOWED.includes(file.type))
      return NextResponse.json({ error: 'JPEG, PNG or WebP only' }, { status: 400 })
    if (file.size > MAX)
      return NextResponse.json({ error: 'Max 10 MB' }, { status: 400 })

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'

    // Store as base64 data URI in the database — works on read-only filesystems (Vercel)
    const buffer = Buffer.from(await file.arrayBuffer())
    const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`

    await setSetting('bgImageUrl' as never, dataUri as never)

    const url = `/api/files/bgimage.${ext}`
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
