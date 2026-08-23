import { NextRequest, NextResponse } from 'next/server'

function extractRepo(input: string): string {
  // Accept "microsoft/vscode" or full GitHub URL
  try {
    const url = new URL(input)
    const parts = url.pathname.replace(/^\//, '').split('/')
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
  } catch { /* not a URL */ }
  return input.trim()
}

export async function POST(req: NextRequest) {
  try {
    const { repo, labels = '', state = 'open', count = 100 } = await req.json() as {
      repo: string; labels?: string; state?: string; count?: number
    }
    if (!repo?.trim()) return NextResponse.json({ error: 'Repo required (e.g. microsoft/vscode)' }, { status: 400 })

    const repoId = extractRepo(repo)
    const perPage = Math.min(count, 100)
    const params = new URLSearchParams({ state, per_page: String(perPage) })
    if (labels) params.set('labels', labels)

    const res = await fetch(`https://api.github.com/repos/${repoId}/issues?${params}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'ProductResearch/1.0',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) throw new Error(`GitHub returned ${res.status}: ${await res.text()}`)
    const issues = await res.json() as Record<string, unknown>[]

    const mapped = issues
      .filter(i => !i.pull_request)
      .map(i => ({
        id: i.number ?? '',
        title: i.title ?? '',
        content: (i.body as string)?.slice(0, 500) ?? '',
        author: (i.user as { login?: string })?.login ?? '',
        score: i.reactions ? (i.reactions as { total_count?: number }).total_count ?? 0 : 0,
        numComments: i.comments ?? 0,
        at: i.created_at ?? '',
        url: i.html_url ?? '',
        labels: ((i.labels as { name: string }[]) ?? []).map(l => l.name).join(', '),
        state: i.state ?? '',
      }))

    return NextResponse.json({ posts: mapped, total: mapped.length, repo: repoId })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
