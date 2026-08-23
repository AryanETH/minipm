import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'
import { renderTemplate, IMAGE_FORMATS } from '@/lib/images/templates'
import type { TemplateKey } from '@/lib/images/templates'

const execFileAsync = promisify(execFile)

// Find the best available Chromium-based browser on Windows
function findChrome(): string | null {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

// Convert a public-relative URL like /generated/avatar.png into a base64 data URI
// so the exported HTML is fully self-contained (no network needed by headless Chrome)
async function resolveAvatarToDataUri(avatarUrl: string): Promise<string> {
  if (!avatarUrl) return ''
  // Already a data URI — pass through
  if (avatarUrl.startsWith('data:')) return avatarUrl

  try {
    // Strip any cache-busting query string before resolving the file path
    const cleanPath = avatarUrl.split('?')[0]
    // Map the public URL path to the actual file on disk
    const filePath = path.join(process.cwd(), 'public', cleanPath.replace(/^\//, ''))
    if (!existsSync(filePath)) return ''

    const buffer = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const mime =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : ext === 'gif' ? 'image/gif'
      : 'image/png'

    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    templateId?: string
    format?: string
    headline?: string
    subheadline?: string
    author?: string
    handle?: string
    category?: string
    avatarUrl?: string
    verified?: boolean
    postBody?: string
    ext?: 'png' | 'jpg'
    advertMode?: boolean
    advertLogoUrl?: string
    advertLogoText?: string
    advertTagline?: string
    advertBgColor?: string
    bgImageUrl?: string
    accentColor?: string
    brandName?: string
    categoryLabel?: string
  }

  const templateId = body.templateId || 'tweet-card'
  const formatKey = body.format || 'SQUARE'
  const ext = body.ext || 'png'

  const imageFormat = IMAGE_FORMATS[formatKey]
  if (!imageFormat) {
    return NextResponse.json({ error: 'Unknown format' }, { status: 400 })
  }

  const avatarDataUri = await resolveAvatarToDataUri(body.avatarUrl || '')
  const logoDataUri   = await resolveAvatarToDataUri(body.advertLogoUrl || '')
  const bgDataUri     = await resolveAvatarToDataUri(body.bgImageUrl || '')

  const html = renderTemplate(templateId as TemplateKey, {
    headline: body.headline || '',
    subheadline: body.subheadline || '',
    author: body.author || 'Creator',
    handle: body.handle || '@creator',
    category: body.category || 'AI',
    avatarUrl: avatarDataUri,
    verified: body.verified !== false,
    postBody: body.postBody || body.headline || '',
    advertMode: body.advertMode,
    advertLogoUrl: logoDataUri,
    advertLogoText: body.advertLogoText,
    advertTagline: body.advertTagline,
    advertBgColor: body.advertBgColor,
    bgImageUrl: bgDataUri,
    accentColor: body.accentColor,
    brandName: body.brandName,
    categoryLabel: body.categoryLabel,
  }, imageFormat)

  // Write the HTML to a temp file
  const tmpHtml = path.join(os.tmpdir(), `ce_preview_${Date.now()}.html`)
  const tmpImg = path.join(os.tmpdir(), `ce_export_${Date.now()}.${ext}`)

  try {
    await writeFile(tmpHtml, html, 'utf-8')

    const chrome = findChrome()
    if (!chrome) {
      return NextResponse.json(
        { error: 'No Chrome or Edge found on this machine. Use "Preview in Browser" to save manually.' },
        { status: 422 }
      )
    }

    // Run headless Chrome to screenshot the page
    const args = [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${imageFormat.width},${imageFormat.height}`,
      `--screenshot=${tmpImg}`,
      '--default-background-color=ffffff',
      `file:///${tmpHtml.replace(/\\/g, '/')}`,
    ]
    if (ext === 'jpg') args.push('--screenshot-format=jpeg')

    await execFileAsync(chrome, args, { timeout: 30_000 })

    const imgBuffer = await readFile(tmpImg)
    const mimeType = ext === 'jpg' ? 'image/jpeg' : 'image/png'
    const filename = `post-card-${formatKey.toLowerCase()}.${ext}`

    return new NextResponse(imgBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(imgBuffer.length),
      },
    })
  } finally {
    await unlink(tmpHtml).catch(() => {})
    await unlink(tmpImg).catch(() => {})
  }
}
