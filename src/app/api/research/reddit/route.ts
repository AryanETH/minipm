import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { query, subreddit = '', sort = 'new', count = 100 } = await req.json() as {
      query: string; subreddit?: string; sort?: string; count?: number
    }
    if (!query?.trim()) return NextResponse.json({ error: 'Query required' }, { status: 400 })

    const base = subreddit
      ? `https://www.reddit.com/r/${subreddit}/search.json`
      : 'https://www.reddit.com/search.json'

    const params = new URLSearchParams({
      q: query,
      sort,
      limit: String(Math.min(count, 100)),
      ...(subreddit ? { restrict_sr: '1' } : {}),
    })

    const res = await fetch(`${base}?${params}`, {
      headers: { 'User-Agent': 'ProductResearch/1.0 (research tool)' },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) throw new Error(`Reddit returned ${res.status}`)
    const data = await res.json() as { data: { children: { data: Record<string, unknown> }[] } }

    const posts = data.data.children.map(c => ({
      id: c.data.id ?? '',
      title: c.data.title ?? '',
      content: c.data.selftext ?? '',
      author: c.data.author ?? '',
      score: c.data.score ?? 0,
      numComments: c.data.num_comments ?? 0,
      at: c.data.created_utc ? new Date((c.data.created_utc as number) * 1000).toISOString() : '',
      url: `https://reddit.com${c.data.permalink ?? ''}`,
      subreddit: c.data.subreddit ?? '',
    }))

    return NextResponse.json({ posts, total: posts.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
