import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const gplay = require('google-play-scraper') as Record<string, (...args: unknown[]) => Promise<unknown>>

export async function POST(req: NextRequest) {
  try {
    const { appIds } = await req.json() as { appIds: string[] }
    if (!appIds?.length) return NextResponse.json({ error: 'Provide at least one app ID' }, { status: 400 })

    const results = await Promise.all(
      appIds.slice(0, 10).map(async (rawId) => {
        let appId = rawId.trim()
        try {
          const url = new URL(rawId)
          appId = url.searchParams.get('id') || rawId.trim()
        } catch { /* not a URL */ }

        try {
          const app = await (gplay.app as (opts: unknown) => Promise<Record<string, unknown>>)({ appId, lang: 'en', country: 'us' })
          return {
            appId,
            title: app.title ?? '',
            developer: app.developer ?? '',
            score: app.score ?? 0,
            ratings: app.ratings ?? 0,
            reviews: app.reviews ?? 0,
            installs: app.installs ?? '',
            version: app.version ?? '',
            updated: app.updated ?? '',
            genre: app.genre ?? '',
            size: app.size ?? '',
            description: (app.description as string)?.slice(0, 300) ?? '',
            url: app.url ?? '',
            icon: app.icon ?? '',
          }
        } catch (e) {
          return { appId, error: e instanceof Error ? e.message : 'Failed' }
        }
      })
    )

    return NextResponse.json({ apps: results })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
