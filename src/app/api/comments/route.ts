import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const status = searchParams.get('status') // 'unprocessed' | 'filtered' | 'all'
  const sourceId = searchParams.get('sourceId')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}
  if (status === 'unprocessed') { where.filtered = false; where.processed = false }
  else if (status === 'filtered') where.filtered = true
  if (sourceId) where.sourceId = sourceId

  const [total, comments] = await Promise.all([
    prisma.comment.count({ where }),
    prisma.comment.findMany({
      where,
      orderBy: [{ likeCount: 'desc' }, { discoveredAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { idea: true },
    }),
  ])

  return NextResponse.json({ comments, total, page, limit })
}
