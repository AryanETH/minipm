import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

export async function POST(req: NextRequest) {
  let browser
  try {
    const body = await req.json() as { url: string }
    const { url } = body

    if (!url?.trim()) {
      return NextResponse.json({ error: 'Instagram URL is required' }, { status: 400 })
    }

    // Validate it looks like an Instagram URL
    if (!url.includes('instagram.com')) {
      return NextResponse.json({ error: 'Please provide a valid Instagram URL' }, { status: 400 })
    }

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    })

    const page = await browser.newPage()

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // Intercept video/mp4 requests to capture the direct video URL
    let videoUrl: string | null = null
    page.on('response', async (response) => {
      const respUrl = response.url()
      const contentType = response.headers()['content-type'] ?? ''
      if (
        (contentType.includes('video/mp4') || respUrl.includes('.mp4') || respUrl.includes('video/mp4')) &&
        !videoUrl
      ) {
        videoUrl = respUrl
      }
    })

    await page.goto(url.trim(), { waitUntil: 'networkidle2', timeout: 30000 })

    // Try to get Open Graph meta tags (thumbnail, caption)
    const meta = await page.evaluate(() => {
      const og = (name: string) =>
        (document.querySelector(`meta[property="${name}"]`) as HTMLMetaElement)?.content ?? ''
      const tw = (name: string) =>
        (document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement)?.content ?? ''

      const videoSrc =
        (document.querySelector('video') as HTMLVideoElement)?.src ||
        (document.querySelector('video source') as HTMLSourceElement)?.src ||
        ''

      return {
        thumbnail: og('og:image') || tw('twitter:image') || '',
        caption:   og('og:description') || tw('twitter:description') || document.title || '',
        videoOG:   og('og:video') || og('og:video:url') || videoSrc || '',
        width:     parseInt(og('og:video:width') || og('og:image:width') || '0', 10) || undefined,
        height:    parseInt(og('og:video:height') || og('og:image:height') || '0', 10) || undefined,
      }
    })

    await browser.close()
    browser = undefined

    const downloadUrl = videoUrl || meta.videoOG || ''

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Could not extract video URL. Instagram may require login for this content.' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      video: {
        url:         url.trim(),
        downloadUrl,
        thumbnail:   meta.thumbnail,
        caption:     meta.caption,
        width:       meta.width,
        height:      meta.height,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch Instagram video'
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
  }
}
