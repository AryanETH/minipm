import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  commentsLimit: z.number().int().min(1).max(500).optional(),
  minimumLikes: z.number().int().min(0).optional(),
  name: z.string().min(1).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const source = await prisma.source.findUnique({
    where: { id },
    include: {
      _count: { select: { videos: true, comments: true } },
      videos: { orderBy: { publishedAt: 'desc' }, take: 5 },
    },
  })
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(source)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const source = await prisma.source.update({ where: { id }, data: parsed.data })
  return NextResponse.json(source)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.source.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
