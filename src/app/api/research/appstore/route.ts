import { NextRequest, NextResponse } from 'next/server'
// @ts-expect-error — no types
import store from 'app-store-scraper'

function extractAppId(input: string): string | number {
  // Numeric ID or URL like https://apps.apple.com/us/app/instagram/id389801252
  const numMatch = input.match(/id(\d+)/)
  if (numMatch) return parseInt(numMatch[1], 10)
  const numOnly = input.match(/^\d+$/)
  if (numOnly) return parseInt(input, 10)
  return input.trim()
}

export async function POST(req: NextRequest) {
  try {
    const { appUrl, stars = [1,2,3,4,5], count = 500 } = await req.json() as {
      appUrl: string; stars: number[]; count: number
    }
    if (!appUrl?.trim()) return NextResponse.json({ error: 'App URL or ID required' }, { status: 400 })

    const appId = extractAppId(appUrl.trim())
    const pages = Math.ceil(Math.min(count, 500) / 50)

    const allReviews: Record<string, unknown>[] = []
    for (let page = 1; page <= pages; page++) {
      try {
        const res = await store.reviews({ id: appId, page, country: 'us' }) as Record<string, unknown>[]
        allReviews.push(...res)
      } catch { break }
    }

    const filtered = allReviews
      .filter(r => stars.includes(r.score as number))
      .slice(0, count)
      .map(r => ({
        userName: r.userName ?? '',
        score: r.score ?? 0,
        content: r.text ?? '',
        at: r.updated ?? '',
        thumbsUpCount: 0,
        reviewCreatedVersion: r.version ?? '',
        replyContent: '',
        repliedAt: '',
      }))

    return NextResponse.json({ reviews: filtered, appId: String(appId), total: filtered.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
