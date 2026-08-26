import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Proxy endpoint for downloading Instagram videos.
 * Instagram CDN blocks direct browser downloads (CORS + Referer checks).
 * This route fetches the video server-side and streams it to the client.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoUrl = searchParams.get('url')

  if (!videoUrl) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  // Only allow Instagram CDN domains for security
  let parsed: URL
  try {
    parsed = new URL(videoUrl)
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  const allowedHosts = [
    'instagram.com', 'cdninstagram.com', 'fbcdn.net',
    'scontent.cdninstagram.com', 'video.cdninstagram.com',
  ]
  const isAllowed = allowedHosts.some(h => parsed.hostname.endsWith(h))
  if (!isAllowed) {
    return new NextResponse('URL not from an allowed domain', { status: 403 })
  }

  try {
    const res = await fetch(videoUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer':  'https://www.instagram.com/',
        'Origin':   'https://www.instagram.com',
        'Accept':   'video/mp4,video/*;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      return new NextResponse(`Upstream error: ${res.status}`, { status: res.status })
    }

    const contentType   = res.headers.get('content-type')   ?? 'video/mp4'
    const contentLength = res.headers.get('content-length') ?? ''

    const headers: Record<string, string> = {
      'Content-Type':        contentType,
      'Content-Disposition': 'attachment; filename="instagram-video.mp4"',
      'Cache-Control':       'no-store',
    }
    if (contentLength) headers['Content-Length'] = contentLength

    return new NextResponse(res.body, { headers })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Proxy fetch failed'
    return new NextResponse(msg, { status: 502 })
  }
}
