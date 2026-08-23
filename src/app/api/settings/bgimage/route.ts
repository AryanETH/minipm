import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

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
    const dir  = path.join(process.cwd(), 'public', 'generated')

    for (const e of ['jpg', 'png', 'webp']) {
      const p = path.join(dir, `bgimage.${e}`)
      if (existsSync(p)) await unlink(p).catch(() => {})
    }

    await writeFile(path.join(dir, `bgimage.${ext}`), Buffer.from(await file.arrayBuffer()))
    return NextResponse.json({ url: `/generated/bgimage.${ext}` })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
