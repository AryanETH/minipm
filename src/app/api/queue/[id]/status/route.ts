import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const statusSchema = z.object({
  status: z.enum(['POSTED', 'FAILED', 'REJECTED']),
  errorMessage: z.string().optional(),
  externalId: z.string().optional(),
  url: z.string().optional(),
})

// Mark a post as published (manual mode)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const post = await prisma.scheduledPost.update({
    where: { id },
    data: {
      status: parsed.data.status,
      postedAt: parsed.data.status === 'POSTED' ? new Date() : undefined,
      errorMessage: parsed.data.errorMessage,
    },
  })

  if (parsed.data.status === 'POSTED') {
    await prisma.publishedPost.upsert({
      where: { scheduledPostId: id },
      create: {
        scheduledPostId: id,
        platform: post.platform,
        externalId: parsed.data.externalId,
        url: parsed.data.url,
        postedAt: new Date(),
      },
      update: {
        externalId: parsed.data.externalId,
        url: parsed.data.url,
      },
    })
  }

  return NextResponse.json(post)
}
