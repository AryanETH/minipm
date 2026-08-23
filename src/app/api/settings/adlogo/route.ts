import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { setSetting } from '@/lib/settings'

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

    const dir = path.join(process.cwd(), 'public', 'generated')
    for (const e of ['jpg','png','webp','svg']) {
      const p = path.join(dir, `adlogo.${e}`)
      if (existsSync(p)) await unlink(p).catch(() => {})
    }

    const dest = path.join(dir, `adlogo.${ext}`)
    await writeFile(dest, Buffer.from(await file.arrayBuffer()))

    const url = `/generated/adlogo.${ext}`
    await setSetting('advertLogoUrl' as never, url as never)

    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
