import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const triggerSchema = z.object({
  action: z.enum(['scan_all', 'process_comments', 'check_queue']),
  batchSize: z.number().int().min(1).max(50).optional(),
})

// n8n calls this endpoint to trigger actions
export async function POST(req: NextRequest) {
  // Minimal auth via secret header
  const secret = req.headers.get('x-n8n-secret')
  const expectedSecret = process.env.N8N_SECRET || 'content-engine-local'
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = triggerSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { action, batchSize } = parsed.data
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (action === 'scan_all') {
    const sources = await prisma.source.findMany({ where: { enabled: true } })
    const results = []
    for (const source of sources) {
      try {
        const r = await fetch(`${baseUrl}/api/sources/${source.id}/scan`, {
          method: 'POST',
        })
        results.push({ sourceId: source.id, ok: r.ok })
      } catch {
        results.push({ sourceId: source.id, ok: false })
      }
    }
    return NextResponse.json({ action, results })
  }

  if (action === 'process_comments') {
    const r = await fetch(`${baseUrl}/api/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchSize: batchSize ?? 10 }),
    })
    const data = await r.json()
    return NextResponse.json({ action, ...data })
  }

  if (action === 'check_queue') {
    const now = new Date()
    const due = await prisma.scheduledPost.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      include: { draft: true },
    })
    // In manual mode, just return the list so n8n can notify
    return NextResponse.json({ action, duePosts: due.length, posts: due })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
