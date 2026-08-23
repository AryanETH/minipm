import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const createQueueItemSchema = z.object({
  draftId: z.string().min(1),
  platform: z.enum(['X', 'LINKEDIN']),
  content: z.string().min(1),
  scheduledAt: z.string().datetime().optional().nullable(),
  imageFilePath: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const platform = searchParams.get('platform')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}
  if (status) where.status = status
  if (platform) where.platform = platform

  const [total, posts] = await Promise.all([
    prisma.scheduledPost.count({ where }),
    prisma.scheduledPost.findMany({
      where,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        draft: {
          include: {
            idea: { include: { comment: true } },
          },
        },
        generatedImage: true,
        publishedPost: true,
      },
    }),
  ])

  return NextResponse.json({ posts, total, page, limit })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = createQueueItemSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const post = await prisma.scheduledPost.create({
    data: {
      draftId: parsed.data.draftId,
      platform: parsed.data.platform,
      content: parsed.data.content,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      imageFilePath: parsed.data.imageFilePath,
      status: parsed.data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
    },
    include: {
      draft: true,
    },
  })

  return NextResponse.json(post, { status: 201 })
}
