import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { setSetting } from '@/lib/settings'

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

    // Remove any old avatar files
    const generatedDir = path.join(process.cwd(), 'public', 'generated')
    for (const oldExt of ['jpg', 'png', 'webp', 'gif']) {
      const oldPath = path.join(generatedDir, `avatar.${oldExt}`)
      if (existsSync(oldPath)) {
        await unlink(oldPath).catch(() => {})
      }
    }

    const filePath = path.join(generatedDir, `avatar.${ext}`)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    // Persist the public URL in settings
    const publicUrl = `/generated/avatar.${ext}`
    await setSetting('authorAvatarUrl' as never, publicUrl as never)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
