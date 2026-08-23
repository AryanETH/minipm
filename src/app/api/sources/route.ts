import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { resolveChannel, extractVideoId, getVideoById } from '@/lib/youtube/client'
import { getSetting } from '@/lib/settings'

const createSourceSchema = z.object({
  type: z.enum(['CHANNEL', 'VIDEO', 'KEYWORD']),
  identifier: z.string().min(1),
  commentsLimit: z.number().int().min(1).max(500).optional(),
  minimumLikes: z.number().int().min(0).optional(),
  priority: z.number().int().min(1).max(10).optional(),
})

export async function GET() {
  const sources = await prisma.source.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    include: { _count: { select: { videos: true, comments: true } } },
  })
  return NextResponse.json(sources)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = createSourceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { type, identifier, commentsLimit, minimumLikes, priority } = parsed.data

  // Read API key from DB first, fall back to env
  const dbKey = await getSetting('youtubeApiKey')
  const apiKey = dbKey || process.env.YOUTUBE_API_KEY
  if (apiKey) process.env.YOUTUBE_API_KEY = apiKey

  try {
    let name = identifier
    let handle: string | undefined
    let profileImage: string | undefined
    let resolvedId = identifier

    if (type === 'CHANNEL' && apiKey) {
      const channel = await resolveChannel(identifier)
      name = channel.title
      handle = channel.handle
      profileImage = channel.thumbnailUrl
      resolvedId = channel.id
    } else if (type === 'VIDEO' && apiKey) {
      const videoId = await extractVideoId(identifier)
      if (!videoId) return NextResponse.json({ error: 'Invalid video URL' }, { status: 400 })
      const video = await getVideoById(videoId)
      if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      name = video.title
      resolvedId = videoId
    }

    const source = await prisma.source.create({
      data: {
        type,
        name,
        identifier: resolvedId,
        handle,
        profileImage,
        commentsLimit: commentsLimit ?? 100,
        minimumLikes: minimumLikes ?? 0,
        priority: priority ?? 5,
      },
    })
    return NextResponse.json(source, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create source'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
