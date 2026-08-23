import { NextRequest, NextResponse } from 'next/server'
import { setSetting } from '@/lib/settings'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('avatar') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP or GIF images are allowed' },
        { status: 400 }
      )
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File must be under 5 MB' }, { status: 400 })
    }

    const ext = file.type === 'image/jpeg' ? 'jpg'
      : file.type === 'image/png' ? 'png'
      : file.type === 'image/webp' ? 'webp'
      : 'gif'

    // Store as base64 data URI in the database — works on read-only filesystems (Vercel)
    const buffer = Buffer.from(await file.arrayBuffer())
    const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`

    await setSetting('authorAvatarUrl' as never, dataUri as never)

    // Return a stable URL that the browser can load via our files API
    const publicUrl = `/api/files/avatar.${ext}`
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
