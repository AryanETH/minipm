import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the shortcode from any Instagram URL format */
function extractShortcode(url: string): string | null {
  const patterns = [
    /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/reels\/([A-Za-z0-9_-]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m?.[1]) return m[1]
  }
  return null
}

/** Realistic browser headers to avoid 401s */
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
}

// ─── Strategy 1: Instagram oEmbed API ─────────────────────────────────────────
// Public endpoint — no auth needed. Returns thumbnail + title but NOT the video URL.
// Used to at least get metadata when video extraction fails.
async function tryOembed(url: string): Promise<{ thumbnail: string; caption: string } | null> {
  try {
    const oembed = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&maxwidth=640&fields=thumbnail_url,title,html&access_token=`
    // Try the public (no-token) endpoint first
    const res = await fetch(
      `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`,
      { headers: HEADERS, signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>
      return {
        thumbnail: String(data.thumbnail_url ?? ''),
        caption:   String(data.title ?? ''),
      }
    }
    void oembed // suppress unused warning
    return null
  } catch {
    return null
  }
}

// ─── Strategy 2: Parse the page HTML directly ────────────────────────────────
// Instagram embeds JSON-LD and og: meta tags in public post pages.
async function tryPageScrape(url: string): Promise<{
  videoUrl: string
  thumbnail: string
  caption: string
  width?: number
  height?: number
} | null> {
  try {
    // Use the /embed/ URL — it's lighter and more permissive than the main page
    const shortcode = extractShortcode(url)
    const fetchUrl  = shortcode
      ? `https://www.instagram.com/p/${shortcode}/embed/captioned/`
      : url

    const res = await fetch(fetchUrl, {
      headers: {
        ...HEADERS,
        'Referer': 'https://www.instagram.com/',
      },
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) return null
    const html = await res.text()

    // Extract video URL from the embed page source
    // Instagram embeds a <video> tag or puts the URL in a data attribute
    const videoPatterns = [
      /video_url["']?\s*:\s*["']([^"']+\.mp4[^"']*)/,
      /"contentUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/,
      /src=["']([^"']+\.mp4[^"']*)/,
      /"video_url":"([^"]+)"/,
    ]

    let videoUrl = ''
    for (const pat of videoPatterns) {
      const m = html.match(pat)
      if (m?.[1]) {
        videoUrl = m[1].replace(/\\u0026/g, '&').replace(/\\/g, '')
        break
      }
    }

    // Extract OG metadata
    const ogImage   = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    const ogDesc    = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/)
    const ogVidW    = html.match(/<meta[^>]+property="og:video:width"[^>]+content="([^"]+)"/)
    const ogVidH    = html.match(/<meta[^>]+property="og:video:height"[^>]+content="([^"]+)"/)

    // Also try to grab thumbnail from the embed's <img> tag
    const embedImg  = html.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]+src="([^"]+)"/)

    const thumbnail = ogImage?.[1] || embedImg?.[1] || ''
    const caption   = ogDesc?.[1]?.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"') || ''

    return {
      videoUrl,
      thumbnail: thumbnail.replace(/&amp;/g, '&'),
      caption,
      width:  ogVidW?.[1] ? parseInt(ogVidW[1]) : undefined,
      height: ogVidH?.[1] ? parseInt(ogVidH[1]) : undefined,
    }
  } catch {
    return null
  }
}

// ─── Strategy 3: Public GraphQL endpoint ─────────────────────────────────────
async function tryGraphQL(shortcode: string): Promise<{
  videoUrl: string
  thumbnail: string
  caption: string
  width?: number
  height?: number
} | null> {
  try {
    const res = await fetch(
      `https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables=${encodeURIComponent(JSON.stringify({ shortcode }))}`,
      {
        headers: {
          ...HEADERS,
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) return null
    const data = await res.json() as Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const media = (data as any)?.data?.shortcode_media
    if (!media) return null

    const videoUrl  = String(media.video_url ?? '')
    const thumbnail = String(media.display_url ?? media.thumbnail_src ?? '')
    const caption   = String(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (media.edge_media_to_caption?.edges?.[0]?.node?.text as string) ?? ''
    )

    return {
      videoUrl,
      thumbnail,
      caption,
      width:  media.dimensions?.width  as number | undefined,
      height: media.dimensions?.height as number | undefined,
    }
  } catch {
    return null
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { url: string }
    const { url } = body

    if (!url?.trim()) {
      return NextResponse.json({ error: 'Instagram URL is required' }, { status: 400 })
    }
    if (!url.includes('instagram.com')) {
      return NextResponse.json({ error: 'Please provide a valid Instagram URL' }, { status: 400 })
    }

    const cleanUrl   = url.trim().split('?')[0].replace(/\/$/, '')
    const shortcode  = extractShortcode(cleanUrl)

    // Run strategies in parallel for speed
    const [pageResult, graphResult, oembedResult] = await Promise.allSettled([
      tryPageScrape(cleanUrl),
      shortcode ? tryGraphQL(shortcode) : Promise.resolve(null),
      tryOembed(cleanUrl),
    ])

    const page    = pageResult.status    === 'fulfilled' ? pageResult.value    : null
    const graph   = graphResult.status   === 'fulfilled' ? graphResult.value   : null
    const oembed  = oembedResult.status  === 'fulfilled' ? oembedResult.value  : null

    // Merge results — prefer graph (most complete), then page, then oembed for fallbacks
    const videoUrl  = graph?.videoUrl  || page?.videoUrl  || ''
    const thumbnail = graph?.thumbnail || page?.thumbnail || oembed?.thumbnail || ''
    const caption   = graph?.caption   || page?.caption   || oembed?.caption   || ''
    const width     = graph?.width     || page?.width
    const height    = graph?.height    || page?.height

    if (!videoUrl && !thumbnail) {
      return NextResponse.json(
        {
          error: 'Could not extract media. Instagram may require login for this post, or the URL is private/expired.',
          hint:  'Try a public Reel or post URL. Private accounts require authentication.',
        },
        { status: 422 }
      )
    }

    // If we have a video URL, provide a proxy download URL so CORS doesn't block the browser
    const proxyDownloadUrl = videoUrl
      ? `/api/research/instagram/proxy?url=${encodeURIComponent(videoUrl)}`
      : ''

    return NextResponse.json({
      video: {
        url:         cleanUrl,
        shortcode:   shortcode ?? '',
        videoUrl,                    // direct URL (may have CORS restrictions)
        downloadUrl: proxyDownloadUrl, // proxied through our server
        thumbnail,
        caption,
        width,
        height,
        hasVideo: !!videoUrl,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch Instagram media'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
