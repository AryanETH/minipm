import { NextRequest, NextResponse } from 'next/server'
// @ts-expect-error — no types for google-play-scraper
import gplay from 'google-play-scraper'

function extractAppId(input: string): string {
  // Accept either a raw app ID like "com.instagram.android"
  // or a full Play Store URL like https://play.google.com/store/apps/details?id=com.instagram.android
  try {
    const url = new URL(input)
    const id = url.searchParams.get('id')
    if (id) return id
  } catch {
    // not a URL — treat as raw app ID
  }
  return input.trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      appUrl: string
      stars: number[]   // e.g. [1, 2] — which star ratings to fetch
      count?: number
    }

    const { appUrl, stars, count = 500 } = body

    if (!appUrl?.trim()) {
      return NextResponse.json({ error: 'App URL or ID is required' }, { status: 400 })
    }
    if (!stars?.length) {
      return NextResponse.json({ error: 'Select at least one star rating' }, { status: 400 })
    }

    const appId = extractAppId(appUrl)

    // Map star number → google-play-scraper sort score filter
    // The library doesn't have a built-in "filter by score" param,
    // so we fetch all and filter client-side. We over-fetch to account for filtering.
    const fetchCount = Math.min(count * stars.length * 3, 2000)

    const Sort = gplay.sort as Record<string, number>

    const result: Record<string, unknown>[] = await gplay.reviews({
      appId,
      lang: 'en',
      country: 'us',
      sort: Sort.NEWEST,
      num: fetchCount,
    }).then((r: { data: Record<string, unknown>[] }) => r.data)

    // Filter by selected star ratings
    const filtered = result.filter(
      (r) => stars.includes(r.score as number)
    )

    // Return the first `count` that match
    const final = filtered.slice(0, count).map((r) => ({
      userName:             r.userName             ?? '',
      score:                r.score                ?? '',
      content:              r.text                 ?? '',
      at:                   r.date                 ? new Date(r.date as string).toISOString() : '',
      thumbsUpCount:        r.thumbsUp             ?? 0,
      reviewCreatedVersion: r.version              ?? '',
      replyContent:         r.replyText            ?? '',
      repliedAt:            r.replyDate            ? new Date(r.replyDate as string).toISOString() : '',
    }))

    return NextResponse.json({ reviews: final, appId, total: final.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Scrape failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
