import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { query, type = 'story', count = 100 } = await req.json() as {
      query: string; type?: string; count?: number
    }
    if (!query?.trim()) return NextResponse.json({ error: 'Query required' }, { status: 400 })

    // Algolia HN Search API — public, no auth required
    const params = new URLSearchParams({
      query,
      tags: type, // story | comment | ask_hn | show_hn | job
      hitsPerPage: String(Math.min(count, 100)),
    })

    const res = await fetch(`https://hn.algolia.com/api/v1/search?${params}`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`HN API returned ${res.status}`)

    const data = await res.json() as {
      hits: Record<string, unknown>[]
    }

    const posts = data.hits.map(h => ({
      id: h.objectID ?? '',
      title: (h.title ?? h.story_title ?? '') as string,
      content: ((h.comment_text ?? h.story_text ?? '') as string).replace(/<[^>]+>/g, '').slice(0, 500),
      author: h.author ?? '',
      score: h.points ?? 0,
      numComments: h.num_comments ?? 0,
      at: h.created_at ?? '',
      url: h.url ? String(h.url) : `https://news.ycombinator.com/item?id=${h.objectID}`,
    }))

    return NextResponse.json({ posts, total: posts.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
