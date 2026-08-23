import { NextRequest, NextResponse } from 'next/server'
import { getAllSettings, setSettings } from '@/lib/settings'

export async function GET() {
  const settings = await getAllSettings()
  // Mask API key for client
  return NextResponse.json({
    ...settings,
    youtubeApiKey: settings.youtubeApiKey ? '***configured***' : '',
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // Don't overwrite the actual key if the masked value is sent back
  if (body.youtubeApiKey === '***configured***') {
    delete body.youtubeApiKey
  }
  await setSettings(body)
  return NextResponse.json({ ok: true })
}
