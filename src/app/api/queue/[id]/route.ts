import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const updateSchema = z.object({
  status: z.enum(['DRAFT', 'APPROVED', 'SCHEDULED', 'POSTED', 'FAILED', 'REJECTED']).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  content: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.scheduledAt) data.scheduledAt = new Date(parsed.data.scheduledAt)

  const post = await prisma.scheduledPost.update({ where: { id }, data })
  return NextResponse.json(post)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.scheduledPost.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
