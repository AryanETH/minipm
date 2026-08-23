import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const updateSchema = z.object({
  status: z.enum(['PENDING', 'SAVED', 'REJECTED', 'DRAFTED']).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      comment: { include: { source: true } },
      drafts: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(idea)
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
  const idea = await prisma.idea.update({ where: { id }, data: parsed.data })
  return NextResponse.json(idea)
}
