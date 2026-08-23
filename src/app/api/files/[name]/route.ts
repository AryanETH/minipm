import { NextRequest, NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'

export const runtime = 'nodejs'

// Map file names to settings keys
const FILE_TO_SETTING: Record<string, string> = {
  'avatar':  'authorAvatarUrl',
  'adlogo':  'advertLogoUrl',
  'bgimage': 'bgImageUrl',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params

  // Strip extension to get the base key (e.g. "avatar.png" → "avatar")
  const base = name.replace(/\.[^.]+$/, '')
  const settingKey = FILE_TO_SETTING[base]

  if (!settingKey) {
    return new NextResponse('Not found', { status: 404 })
  }

  const dataUri = await getSetting(settingKey as keyof import('@/lib/settings').AppSettings)

  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Parse the data URI: data:<mime>;base64,<data>
  const [header, b64] = dataUri.split(',')
  const mime = header.replace('data:', '').replace(';base64', '')
  const buffer = Buffer.from(b64, 'base64')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
